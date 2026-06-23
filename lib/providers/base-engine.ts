/**
 * M3 多模型 Provider 客户端 — BaseEngine 抽象基类
 *
 * 负责：
 *   - SSE 流式解析（eventsource-parser，解决中文多字节截断乱码）
 *   - 首 Token 延迟（TTFT）、Tokens/s（TPS）指标记录
 *   - SSE 断线指数退避重连：1s → 2s → 4s → 8s → 16s → max 30s，最多 5 次
 *   - HTTP 错误码分层处理（401/403 认证错误、429 限流、5xx 服务器错误）
 *   - AbortSignal 监听：用户主动中止不触发重连
 *
 * 子类仅需实现：
 *   - id / name / requiresApiKey / isLocal
 *   - buildHeaders / buildBody / getBaseUrl / parseSSEChunk
 */

import { createParser, type EventSourceMessage } from 'eventsource-parser';
import type {
  IEngine,
  Message,
  ChatStreamOptions,
  RequestMetrics,
  ProviderError,
  ReconnectState,
} from './types';
import {
  EngineError,
  ERR_MISSING_API_KEY,
  ERR_ABORTED,
  ERR_AUTH,
  ERR_RATE_LIMIT,
  ERR_SERVER,
  ERR_NETWORK,
  ERR_TIMEOUT,
} from './types';
import { estimateCost } from './pricing';

// ─────────────────────────────────────────────
// Reconnect constants
// ─────────────────────────────────────────────

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const RECONNECT_MAX_ATTEMPTS = 5;

// ─────────────────────────────────────────────
// Helper utilities
// ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number): number {
  const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt - 1);
  return Math.min(delay, RECONNECT_MAX_DELAY_MS);
}

function parseRateLimitReset(headers: Headers): number | undefined {
  const reset = headers.get('x-ratelimit-reset-requests')
    ?? headers.get('x-ratelimit-reset')
    ?? headers.get('retry-after');
  if (!reset) return undefined;
  const num = parseFloat(reset);
  if (!isNaN(num)) return num * 1000; // seconds → ms
  const date = new Date(reset);
  if (!isNaN(date.getTime())) return date.getTime() - Date.now();
  return undefined;
}

// ─────────────────────────────────────────────
// BaseEngine
// ─────────────────────────────────────────────

export abstract class BaseEngine implements IEngine {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly requiresApiKey: boolean;
  abstract readonly isLocal: boolean;
  readonly experimental?: boolean;

  // ── IEngine interface — subclasses implement these ──

  abstract buildHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string>;
  abstract buildBody(
    messages: Message[],
    model: string,
    stream: boolean,
    options?: ChatStreamOptions,
  ): unknown;
  abstract getBaseUrl(customBaseUrl?: string): string;
  abstract parseSSEChunk(chunk: string): string | null;

  // ── Internal helper for subclasses ──────────

  protected resolveBaseUrl(customBaseUrl?: string): string {
    return this.getBaseUrl(customBaseUrl).replace(/\/$/, '');
  }

  protected validateApiKey(apiKey: string): void {
    if (this.requiresApiKey && !apiKey?.trim()) {
      throw new EngineError({
        code: ERR_MISSING_API_KEY,
        message: `API Key is not configured for provider "${this.name}"`,
        provider: this.id,
        retryable: false,
      });
    }
  }

  // ── Core streaming method ────────────────────

  /**
   * Execute a streaming request with full SSE parsing, TTFT/TPS tracking,
   * and exponential-backoff reconnection.
   */
  async chatStream(options: ChatStreamOptions): Promise<RequestMetrics> {
    const { apiKey, signal } = options;
    this.validateApiKey(apiKey);

    const state: ReconnectState = {
      attempt: 0,
      accumulatedText: '',
      lastEventId: undefined,
    };

    // Track metrics across potential reconnects
    const startTime = performance.now();
    let firstTokenTime: number | null = null;
    let promptTokens = 0;
    let completionTokens = 0;
    let cached = false;

    while (true) {
      if (signal.aborted) {
        throw new EngineError({ code: ERR_ABORTED, message: 'Request was aborted', provider: this.id });
      }

      try {
        const result = await this._streamOnce(options, state, {
          onFirstToken: (t) => { if (firstTokenTime === null) firstTokenTime = t; },
          onUsage: (p, c, isCached) => { promptTokens = p; completionTokens = c; cached = isCached; },
        });

        const endTime = performance.now();
        const totalLatency = endTime - startTime;
        const ttft = firstTokenTime !== null ? firstTokenTime - startTime : 0;
        const generationSeconds = firstTokenTime !== null ? (endTime - firstTokenTime) / 1000 : totalLatency / 1000;
        const tps = generationSeconds > 0 ? completionTokens / generationSeconds : 0;
        const cost = estimateCost(options.model, promptTokens, completionTokens, cached);

        const metrics: RequestMetrics = {
          ttft,
          tps,
          totalTokens: promptTokens + completionTokens,
          cost,
          cached,
          promptTokens,
          completionTokens,
          totalLatency,
        };

        options.onMetrics(metrics);
        return metrics;
      } catch (err) {
        if (signal.aborted) {
          throw new EngineError({ code: ERR_ABORTED, message: 'Request was aborted', provider: this.id });
        }

        if (err instanceof EngineError) {
          // Auth errors — do not retry
          if (err.code === ERR_AUTH || err.code === ERR_MISSING_API_KEY) {
            options.onError(err);
            throw err;
          }

          // Rate limit — wait for reset time if available, then treat as retryable
          if (err.code === ERR_RATE_LIMIT) {
            const resetMs = (err as EngineError & { resetMs?: number }).resetMs;
            if (resetMs && resetMs > 0 && resetMs < 60_000) {
              await sleep(resetMs);
            }
            // Fall through to reconnect logic
          }
        }

        state.attempt++;
        if (state.attempt > RECONNECT_MAX_ATTEMPTS) {
          const finalErr: ProviderError = err instanceof EngineError
            ? err
            : { code: ERR_NETWORK, message: String(err), provider: this.id };
          options.onError(finalErr);
          throw err;
        }

        const delay = backoffDelay(state.attempt);
        // Signal reconnect to UI via a special delta (empty string with metadata)
        options.onError({
          code: 'RECONNECTING',
          message: `连接断开，${delay / 1000}s 后重试（第 ${state.attempt}/${RECONNECT_MAX_ATTEMPTS} 次）`,
          provider: this.id,
          retryable: true,
        });
        await sleep(delay);
      }
    }
  }

  // ── Single SSE stream attempt ────────────────

  private async _streamOnce(
    options: ChatStreamOptions,
    state: ReconnectState,
    hooks: {
      onFirstToken: (t: number) => void;
      onUsage: (prompt: number, completion: number, cached: boolean) => void;
    },
  ): Promise<void> {
    const { messages, model, apiKey, customBaseUrl, systemPrompt, parameters, signal, onDelta } = options;

    // Build message list with optional system prompt prepended
    const fullMessages: Message[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const body = this.buildBody(fullMessages, model, true, options);
    const headers = this.buildHeaders(apiKey, state.lastEventId ? { 'Last-Event-ID': state.lastEventId } : undefined);
    const url = this.buildRequestUrl(options);

    let response: Response;
    try {
      const timeout = parameters?.timeoutMs as number | undefined ?? 30_000;
      const timeoutId = setTimeout(() => {
        if (!signal.aborted) {
          throw new EngineError({ code: ERR_TIMEOUT, message: `Request timed out after ${timeout}ms`, provider: this.id });
        }
      }, timeout);

      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });
      clearTimeout(timeoutId);
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw new EngineError({ code: ERR_ABORTED, message: 'Request was aborted', provider: this.id });
      }
      throw new EngineError({
        code: ERR_NETWORK,
        message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
        provider: this.id,
        retryable: true,
      });
    }

    await this._handleHttpError(response, options);
    await this._readSSEStream(response, signal, onDelta, hooks, state);
  }

  // ── HTTP error handling ──────────────────────

  private async _handleHttpError(response: Response, options: ChatStreamOptions): Promise<void> {
    if (response.ok) return;

    const text = await response.text().catch(() => '');
    const status = response.status;

    if (status === 401 || status === 403) {
      const err = new EngineError({
        code: ERR_AUTH,
        message: `Authentication failed (${status}): API Key may be invalid. Please check your settings.`,
        provider: this.id,
        httpStatus: status,
        retryable: false,
      });
      options.onError(err);
      throw err;
    }

    if (status === 429) {
      const resetMs = parseRateLimitReset(response.headers);
      const err = Object.assign(new EngineError({
        code: ERR_RATE_LIMIT,
        message: `Rate limit exceeded. ${resetMs ? `Reset in ${Math.ceil(resetMs / 1000)}s.` : 'Please wait before retrying.'}`,
        provider: this.id,
        httpStatus: status,
        retryable: true,
      }), { resetMs });
      throw err;
    }

    if (status >= 500) {
      throw new EngineError({
        code: ERR_SERVER,
        message: `Server error ${status}: ${text.slice(0, 200)}`,
        provider: this.id,
        httpStatus: status,
        retryable: true,
      });
    }

    throw new EngineError({
      code: `HTTP_${status}`,
      message: `HTTP ${status}: ${text.slice(0, 200)}`,
      provider: this.id,
      httpStatus: status,
      retryable: false,
    });
  }

  // ── SSE stream reader ────────────────────────

  private async _readSSEStream(
    response: Response,
    signal: AbortSignal,
    onDelta: (text: string) => void,
    hooks: {
      onFirstToken: (t: number) => void;
      onUsage: (prompt: number, completion: number, cached: boolean) => void;
    },
    state: ReconnectState,
  ): Promise<void> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: false });

    const parser = createParser({
      onEvent: (event: EventSourceMessage) => {
        if (event.id) state.lastEventId = event.id;
        if (!event.data || event.data === '[DONE]') return;

        const delta = this.parseSSEChunk(event.data);
        if (delta !== null && delta.length > 0) {
          hooks.onFirstToken(performance.now());
          state.accumulatedText += delta;
          onDelta(delta);
        }

        // Try to extract usage info from any chunk (best-effort)
        this._tryExtractUsage(event.data, hooks);
      },
    });

    try {
      while (true) {
        if (signal.aborted) {
          throw new EngineError({ code: ERR_ABORTED, message: 'Request was aborted', provider: this.id });
        }
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ── Usage extraction helper ──────────────────

  protected _tryExtractUsage(
    data: string,
    hooks: { onUsage: (prompt: number, completion: number, cached: boolean) => void },
  ): void {
    try {
      const parsed = JSON.parse(data);
      const usage = parsed?.usage ?? parsed?.usageMetadata;
      if (!usage) return;

      const prompt = usage.prompt_tokens ?? usage.promptTokenCount ?? usage.input_tokens ?? 0;
      const completion = usage.completion_tokens ?? usage.candidatesTokenCount ?? usage.output_tokens ?? 0;
      const cached = !!(usage.cache_creation_input_tokens || usage.cached_content_token_count);
      if (prompt > 0 || completion > 0) {
        hooks.onUsage(prompt, completion, cached);
      }
    } catch {
      // Non-JSON data chunk, ignore
    }
  }

  // ── URL builder (override for non-standard paths) ──

  protected buildRequestUrl(options: ChatStreamOptions): string {
    return `${this.resolveBaseUrl(options.customBaseUrl)}/chat/completions`;
  }
}
