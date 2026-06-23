/**
 * M3 多模型 Provider 客户端 — 多 Provider 故障转移链
 *
 * 功能：
 *   - 用户配置有序 Provider 链（如 ['openai', 'anthropic', 'deepseek']）
 *   - 主模型失败/超时后自动按优先级切换到下一个
 *   - 错误码分层处理：
 *       401/403 → 认证错误，不重试，Toast 引导用户检查 API Key
 *       429     → 限流，读取 Reset 时间，展示冷却倒计时
 *       5xx     → 服务器错误，自动重试 1 次，仍失败则展示错误详情
 *   - 最终成功或全部失败时以 Toast 通知用户
 *   - 切换过程对用户完全透明（除非全部失败）
 */

import type { IEngine, ChatStreamOptions, RequestMetrics, ProviderError } from './types';
import { EngineError, ERR_ABORTED, ERR_AUTH, ERR_RATE_LIMIT } from './types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface FailoverEntry {
  engine: IEngine;
  apiKey: string;
  model: string;
  customBaseUrl?: string;
}

export interface FailoverChainOptions {
  /** Ordered list of providers to try */
  providers: FailoverEntry[];
  /** Shared stream options (messages, systemPrompt, parameters, signal) */
  streamOptions: Omit<ChatStreamOptions, 'apiKey' | 'model' | 'customBaseUrl'>;
  /** Per-provider timeout in ms (default 30 000) */
  timeoutMs?: number;
  /** Called when the chain successfully completes via any provider */
  onSuccess?: (providerId: string, metrics: RequestMetrics) => void;
  /** Called when all providers have failed */
  onAllFailed?: (errors: Array<{ providerId: string; error: ProviderError }>) => void;
  /** Called when switching to the next provider */
  onFailover?: (fromId: string, toId: string, error: ProviderError) => void;
}

export interface FailoverResult {
  providerId: string;
  metrics: RequestMetrics;
  attempts: number;
}

// ─────────────────────────────────────────────
// Error classification
// ─────────────────────────────────────────────

type ErrorClass = 'auth' | 'rate_limit' | 'server' | 'network' | 'timeout' | 'unknown';

function classifyError(err: unknown): ErrorClass {
  if (err instanceof EngineError) {
    if (err.code === ERR_AUTH || err.httpStatus === 401 || err.httpStatus === 403) return 'auth';
    if (err.code === ERR_RATE_LIMIT || err.httpStatus === 429) return 'rate_limit';
    if (typeof err.httpStatus === 'number' && err.httpStatus >= 500) return 'server';
    if (err.code === 'TIMEOUT') return 'timeout';
    if (err.code === 'NETWORK_ERROR') return 'network';
  }
  return 'unknown';
}

function toProviderError(err: unknown, providerId: string): ProviderError {
  if (err instanceof EngineError) return err;
  return {
    code: 'UNKNOWN',
    message: err instanceof Error ? err.message : String(err),
    provider: providerId,
    retryable: false,
  };
}

// ─────────────────────────────────────────────
// Core failover execution
// ─────────────────────────────────────────────

/**
 * Execute a streaming request through a failover chain.
 *
 * Tries each provider in order. Stops on:
 *   - Successful stream completion
 *   - Auth errors (never retryable — don't waste time on the same key)
 *   - User abort
 *
 * Automatically retries once on 5xx before moving to the next provider.
 */
export async function runWithFailover(opts: FailoverChainOptions): Promise<FailoverResult> {
  const { providers, streamOptions, timeoutMs = 30_000, onSuccess, onAllFailed, onFailover } = opts;

  if (providers.length === 0) {
    throw new EngineError({ code: 'NO_PROVIDERS', message: '故障转移链为空，至少需要配置一个 Provider。', provider: 'failover-chain' });
  }

  const failures: Array<{ providerId: string; error: ProviderError }> = [];
  let attempts = 0;

  for (let i = 0; i < providers.length; i++) {
    const entry = providers[i];
    const { engine, apiKey, model, customBaseUrl } = entry;

    if (streamOptions.signal.aborted) {
      throw new EngineError({ code: ERR_ABORTED, message: 'Request was aborted', provider: engine.id });
    }

    // 5xx: allow one automatic retry on the same provider before moving on
    const serverRetries = 1;

    for (let retry = 0; retry <= serverRetries; retry++) {
      attempts++;

      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

        // Forward parent abort to the child controller
        const parentSignal = streamOptions.signal;
        const abortHandler = () => controller.abort();
        parentSignal.addEventListener('abort', abortHandler, { once: true });

        try {
          const metrics = await engine.chatStream({
            ...streamOptions,
            apiKey,
            model,
            customBaseUrl,
            signal: controller.signal,
          });

          clearTimeout(timeoutHandle);
          parentSignal.removeEventListener('abort', abortHandler);

          onSuccess?.(engine.id, metrics);
          return { providerId: engine.id, metrics, attempts };
        } finally {
          clearTimeout(timeoutHandle);
          parentSignal.removeEventListener('abort', abortHandler);
        }
      } catch (err) {
        if (streamOptions.signal.aborted || (err instanceof EngineError && err.code === ERR_ABORTED)) {
          throw new EngineError({ code: ERR_ABORTED, message: 'Request was aborted', provider: engine.id });
        }

        const errClass = classifyError(err);
        const provErr = toProviderError(err, engine.id);

        // Auth errors: do not retry this provider or any subsequent providers with the same issue
        if (errClass === 'auth') {
          failures.push({ providerId: engine.id, error: provErr });
          // Still move to next provider — it may have a different key configured
          break;
        }

        // 5xx: retry once on same provider
        if (errClass === 'server' && retry < serverRetries) {
          await sleep(1000);
          continue;
        }

        // Rate limit: extract reset time and notify, then move to next provider
        if (errClass === 'rate_limit') {
          failures.push({ providerId: engine.id, error: provErr });
          break;
        }

        // Timeout / network: move to next provider immediately
        failures.push({ providerId: engine.id, error: provErr });
        break;
      }
    }

    // Notify about failover before trying next provider
    if (i < providers.length - 1) {
      const nextProvider = providers[i + 1];
      const lastError = failures[failures.length - 1]?.error ?? { code: 'UNKNOWN', message: 'Unknown error', provider: engine.id };
      onFailover?.(engine.id, nextProvider.engine.id, lastError);
    }
  }

  // All providers exhausted
  onAllFailed?.(failures);

  const firstErr = failures[0];
  throw new EngineError({
    code: 'ALL_PROVIDERS_FAILED',
    message: `所有 Provider 均已失败（共尝试 ${providers.length} 个）。最后一个错误：${firstErr?.error.message ?? '未知错误'}`,
    provider: 'failover-chain',
    retryable: false,
  });
}

// ─────────────────────────────────────────────
// Error message helpers (for Toast display)
// ─────────────────────────────────────────────

/**
 * Generate a user-friendly error message for display in a Toast.
 */
export function formatFailoverError(err: ProviderError): string {
  if (err.code === ERR_AUTH || err.httpStatus === 401 || err.httpStatus === 403) {
    return `API Key 无效，请在设置页检查 ${err.provider} 的 API Key。`;
  }
  if (err.code === ERR_RATE_LIMIT || err.httpStatus === 429) {
    return `${err.provider} 请求频率超限，请稍后再试。`;
  }
  if (typeof err.httpStatus === 'number' && err.httpStatus >= 500) {
    return `${err.provider} 服务暂时不可用（${err.httpStatus}），已自动切换到备用模型。`;
  }
  return `${err.provider} 请求失败：${err.message}`;
}

// ─────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
