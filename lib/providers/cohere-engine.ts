/**
 * M3 多模型 Provider 客户端 — Cohere 适配器
 *
 * 使用 Cohere Chat API v1：
 *   - Header: Authorization: Bearer <apiKey>
 *   - Body: /v1/chat Cohere 格式（chat_history + message）
 *   - SSE 解析：event-type: text-generation → text
 *   - 用量字段：event-type: stream-end → response.meta.tokens
 */

import { BaseEngine } from './base-engine';
import type { Message, ChatStreamOptions, RequestMetrics } from './types';
import { EngineError, ERR_ABORTED, ERR_AUTH, ERR_RATE_LIMIT, ERR_SERVER, ERR_NETWORK } from './types';
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { estimateCost } from './pricing';

export class CohereEngine extends BaseEngine {
  readonly id = 'cohere';
  readonly name = 'Cohere';
  readonly requiresApiKey = true;
  readonly isLocal = false;

  getBaseUrl(customBaseUrl?: string): string {
    return customBaseUrl ?? 'https://api.cohere.ai';
  }

  buildHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extra,
    };
  }

  buildBody(
    messages: Message[],
    model: string,
    _stream: boolean,
    options?: ChatStreamOptions,
  ): unknown {
    // Cohere uses message (last user turn) + chat_history (prior turns)
    const filtered = messages.filter((m) => m.role !== 'system');
    const systemText = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n') || undefined;

    const chatHistory = filtered.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
      message: m.content,
    }));
    const lastMessage = filtered[filtered.length - 1]?.content ?? '';

    const body: Record<string, unknown> = {
      model,
      message: lastMessage,
      chat_history: chatHistory,
      stream: true,
    };
    if (systemText) body.preamble = systemText;
    if (options?.parameters) Object.assign(body, options.parameters);
    return body;
  }

  parseSSEChunk(chunk: string): string | null {
    if (!chunk || chunk === '[DONE]') return null;
    try {
      const data = JSON.parse(chunk);
      if (data.event_type === 'text-generation') {
        return typeof data.text === 'string' && data.text.length > 0 ? data.text : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  protected buildRequestUrl(options: ChatStreamOptions): string {
    return `${this.resolveBaseUrl(options.customBaseUrl)}/v1/chat`;
  }

  // ── Override chatStream to capture Cohere stream-end usage ───────────────

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
      if (signal.aborted) throw new EngineError({ code: ERR_ABORTED, message: 'Aborted', provider: this.id });

      try {
        await this._cohereStream({
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
          throw new EngineError({ code: ERR_ABORTED, message: 'Aborted', provider: this.id });
        }
        if (err instanceof EngineError && (err.code === ERR_AUTH)) {
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

  private async _cohereStream(opts: {
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

    const body = this.buildBody(messages, model, true, { parameters } as ChatStreamOptions);
    const url = `${this.resolveBaseUrl(customBaseUrl)}/v1/chat`;

    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', headers: this.buildHeaders(apiKey), body: JSON.stringify(body), signal });
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw new EngineError({ code: ERR_ABORTED, message: 'Aborted', provider: this.id });
      }
      throw new EngineError({ code: ERR_NETWORK, message: String(err), provider: this.id, retryable: true });
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) throw new EngineError({ code: ERR_AUTH, message: `Auth failed (${response.status})`, provider: this.id, httpStatus: response.status });
      if (response.status === 429) throw new EngineError({ code: ERR_RATE_LIMIT, message: `Rate limit`, provider: this.id, httpStatus: response.status, retryable: true });
      if (response.status >= 500) throw new EngineError({ code: ERR_SERVER, message: `${response.status}: ${text.slice(0, 200)}`, provider: this.id, httpStatus: response.status, retryable: true });
      throw new EngineError({ code: `HTTP_${response.status}`, message: text.slice(0, 200), provider: this.id, httpStatus: response.status });
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: false });

    // Cohere streams newline-delimited JSON (NDJSON), not SSE
    // But wraps it with event-type fields — use the SSE parser anyway
    const parser = createParser({
      onEvent: (event: EventSourceMessage) => {
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data);
          if (data.event_type === 'text-generation' && typeof data.text === 'string') {
            onDelta(data.text);
          }
          if (data.event_type === 'stream-end') {
            const meta = data.response?.meta?.billed_units ?? data.response?.meta?.tokens;
            if (meta) {
              onUsage(meta.input_tokens ?? 0, meta.output_tokens ?? 0);
            }
          }
        } catch { /* ignore */ }
      },
    });

    try {
      while (true) {
        if (signal.aborted) throw new EngineError({ code: ERR_ABORTED, message: 'Aborted', provider: this.id });
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        // Cohere sends NDJSON lines — wrap each line as SSE data for the parser
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (trimmed) parser.feed(`data: ${trimmed}\n\n`);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
