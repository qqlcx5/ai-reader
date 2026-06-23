/**
 * M3 多模型 Provider 客户端 — Anthropic (Claude) 适配器
 *
 * 使用 Anthropic Messages API：
 *   - Header: x-api-key + anthropic-version: 2023-06-01
 *   - SSE 事件类型: content_block_delta → delta.text
 *   - 用量字段: message_delta.usage (input_tokens / output_tokens)
 */

import { BaseEngine } from './base-engine';
import type { Message, ChatStreamOptions, RequestMetrics } from './types';
import { EngineError, ERR_ABORTED, ERR_AUTH, ERR_RATE_LIMIT, ERR_SERVER, ERR_NETWORK } from './types';
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { estimateCost } from './pricing';

export class AnthropicEngine extends BaseEngine {
  readonly id = 'anthropic';
  readonly name = 'Anthropic (Claude)';
  readonly requiresApiKey = true;
  readonly isLocal = false;

  getBaseUrl(customBaseUrl?: string): string {
    return customBaseUrl ?? 'https://api.anthropic.com/v1';
  }

  buildHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      ...extra,
    };
  }

  buildBody(
    messages: Message[],
    model: string,
    _stream: boolean,
    options?: ChatStreamOptions,
  ): unknown {
    // Anthropic takes system separately; filter system messages out of the array
    const systemMessages = messages.filter((m) => m.role === 'system');
    const systemText = systemMessages.map((m) => m.content).join('\n\n') || undefined;

    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const body: Record<string, unknown> = {
      model,
      messages: conversationMessages,
      stream: true,
      max_tokens: 8192,
    };
    if (systemText) body.system = systemText;
    if (options?.parameters) Object.assign(body, options.parameters);
    return body;
  }

  parseSSEChunk(chunk: string): string | null {
    // Only called for non-Anthropic SSE events; Anthropic uses event-typed SSE
    // Actual parsing is done in the overridden chatStream below
    return null;
  }

  protected buildRequestUrl(options: ChatStreamOptions): string {
    return `${this.resolveBaseUrl(options.customBaseUrl)}/messages`;
  }

  // ── Override chatStream to handle Anthropic event types ──────────────────

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
        await this._anthropicStream({
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

  private async _anthropicStream(opts: {
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
    const headers = this.buildHeaders(apiKey);
    const url = `${this.resolveBaseUrl(customBaseUrl)}/messages`;

    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
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
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data);
          // content_block_delta → delta.text
          if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
            onDelta(data.delta.text ?? '');
          }
          // usage in message_delta
          if (data.type === 'message_delta' && data.usage) {
            onUsage(0, data.usage.output_tokens ?? 0);
          }
          // usage in message_start
          if (data.type === 'message_start' && data.message?.usage) {
            onUsage(data.message.usage.input_tokens ?? 0, 0);
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
