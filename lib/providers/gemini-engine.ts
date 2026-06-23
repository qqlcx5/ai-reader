/**
 * M3 多模型 Provider 客户端 — Google Gemini 适配器
 *
 * 使用 Google AI API（generativelanguage.googleapis.com）：
 *   - API Key 通过查询参数传递：?key=<apiKey>
 *   - Body 格式：{ contents: [{ role, parts: [{ text }] }], systemInstruction? }
 *   - SSE 解析：candidates[0].content.parts[0].text
 *   - 用量字段：usageMetadata (promptTokenCount / candidatesTokenCount)
 */

import { BaseEngine } from './base-engine';
import type { Message, ChatStreamOptions, RequestMetrics } from './types';
import { EngineError, ERR_ABORTED, ERR_AUTH, ERR_RATE_LIMIT, ERR_SERVER, ERR_NETWORK } from './types';
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { estimateCost } from './pricing';

export class GeminiEngine extends BaseEngine {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly requiresApiKey = true;
  readonly isLocal = false;

  getBaseUrl(customBaseUrl?: string): string {
    return customBaseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }

  buildHeaders(_apiKey: string, extra?: Record<string, string>): Record<string, string> {
    // API Key is appended to the URL as a query param, not in headers
    return { 'Content-Type': 'application/json', ...extra };
  }

  buildBody(
    messages: Message[],
    _model: string,
    _stream: boolean,
    options?: ChatStreamOptions,
  ): unknown {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const systemText = systemMessages.map((m) => m.content).join('\n\n');

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = { contents };
    if (systemText) {
      body.systemInstruction = { parts: [{ text: systemText }] };
    }
    if (options?.parameters) {
      const { temperature, topP, topK, maxOutputTokens, ...rest } = options.parameters as Record<string, unknown>;
      body.generationConfig = { temperature, topP, topK, maxOutputTokens, ...rest };
    }
    return body;
  }

  parseSSEChunk(chunk: string): string | null {
    if (!chunk || chunk === '[DONE]') return null;
    try {
      const data = JSON.parse(chunk);
      const parts = data?.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts)) return null;
      const text = parts.map((p: { text?: string }) => p.text ?? '').join('');
      return text.length > 0 ? text : null;
    } catch {
      return null;
    }
  }

  // ── Gemini uses a different URL scheme — override chatStream ─────────────

  override async chatStream(options: ChatStreamOptions): Promise<RequestMetrics> {
    const { apiKey, messages, model, customBaseUrl, systemPrompt, parameters, signal, onDelta, onMetrics, onError } = options;
    this.validateApiKey(apiKey);

    const fullMessages: Message[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const startTime = performance.now();
    let firstTokenTime: number | null = null;
    let promptTokens = 0;
    let completionTokens = 0;
    let attempt = 0;
    const MAX_ATTEMPTS = 6;
    const BASE_DELAY = 1000;

    while (true) {
      if (signal.aborted) {
        throw new EngineError({ code: ERR_ABORTED, message: 'Request was aborted', provider: this.id });
      }

      try {
        await this._geminiStream({
          apiKey, messages: fullMessages, model, customBaseUrl, parameters, signal,
          onDelta: (text) => {
            if (firstTokenTime === null) firstTokenTime = performance.now();
            onDelta(text);
          },
          onUsage: (p, c) => { promptTokens = p; completionTokens = c; },
        });

        const endTime = performance.now();
        const totalLatency = endTime - startTime;
        const ttft = firstTokenTime !== null ? firstTokenTime - startTime : 0;
        const genSec = firstTokenTime ? (endTime - firstTokenTime) / 1000 : totalLatency / 1000;
        const tps = genSec > 0 ? completionTokens / genSec : 0;
        const cost = estimateCost(model, promptTokens, completionTokens);

        const metrics: RequestMetrics = { ttft, tps, totalTokens: promptTokens + completionTokens, cost, cached: false, promptTokens, completionTokens, totalLatency };
        onMetrics(metrics);
        return metrics;
      } catch (err) {
        if (signal.aborted || (err instanceof EngineError && err.code === ERR_ABORTED)) {
          throw new EngineError({ code: ERR_ABORTED, message: 'Request was aborted', provider: this.id });
        }
        if (err instanceof EngineError && (err.code === ERR_AUTH || err.httpStatus === 401 || err.httpStatus === 403)) {
          onError(err); throw err;
        }
        attempt++;
        if (attempt >= MAX_ATTEMPTS) {
          const finalErr = err instanceof EngineError ? err : { code: ERR_NETWORK, message: String(err), provider: this.id };
          onError(finalErr); throw err;
        }
        const delay = Math.min(BASE_DELAY * Math.pow(2, attempt - 1), 30_000);
        onError({ code: 'RECONNECTING', message: `连接断开，${delay / 1000}s 后重试`, provider: this.id, retryable: true });
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  private async _geminiStream(opts: {
    apiKey: string;
    messages: Message[];
    model: string;
    customBaseUrl?: string;
    parameters?: Record<string, unknown>;
    signal: AbortSignal;
    onDelta: (text: string) => void;
    onUsage: (prompt: number, completion: number) => void;
  }): Promise<void> {
    const { apiKey, messages, model, customBaseUrl, parameters, signal, onDelta, onUsage } = opts;

    const base = this.resolveBaseUrl(customBaseUrl);
    const url = `${base}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    const body = this.buildBody(messages, model, true, { parameters } as ChatStreamOptions);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(apiKey),
        body: JSON.stringify(body),
        signal,
      });
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw new EngineError({ code: ERR_ABORTED, message: 'Aborted', provider: this.id });
      }
      throw new EngineError({ code: ERR_NETWORK, message: String(err), provider: this.id, retryable: true });
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) {
        throw new EngineError({ code: ERR_AUTH, message: `Auth failed (${response.status})`, provider: this.id, httpStatus: response.status });
      }
      if (response.status === 429) {
        throw new EngineError({ code: ERR_RATE_LIMIT, message: `Rate limit (${response.status})`, provider: this.id, httpStatus: response.status, retryable: true });
      }
      if (response.status >= 500) {
        throw new EngineError({ code: ERR_SERVER, message: `Server error ${response.status}: ${text.slice(0, 200)}`, provider: this.id, httpStatus: response.status, retryable: true });
      }
      throw new EngineError({ code: `HTTP_${response.status}`, message: text.slice(0, 200), provider: this.id, httpStatus: response.status });
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: false });

    const parser = createParser({
      onEvent: (event: EventSourceMessage) => {
        if (!event.data || event.data === '[DONE]') return;
        try {
          const data = JSON.parse(event.data);
          const parts = data?.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts) {
            if (part.text) onDelta(part.text);
          }
          if (data.usageMetadata) {
            onUsage(
              data.usageMetadata.promptTokenCount ?? 0,
              data.usageMetadata.candidatesTokenCount ?? 0,
            );
          }
        } catch { /* ignore */ }
      },
    });

    try {
      while (true) {
        if (signal.aborted) throw new EngineError({ code: ERR_ABORTED, message: 'Aborted', provider: this.id });
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } finally {
      reader.releaseLock();
    }
  }
}
