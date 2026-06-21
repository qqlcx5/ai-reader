/**
 * M3 Provider & LLM Client — Retry logic with exponential backoff
 */
import { ProviderError, RATE_LIMIT, SERVER_ERROR, ABORTED } from './types';

export interface RetryPolicy {
  maxRateLimitRetries: number;
  maxServerErrorRetries: number;
  baseDelayMs: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRateLimitRetries: 3,
  maxServerErrorRetries: 3,
  baseDelayMs: 1000,
  timeoutMs: 60000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): { retryable: boolean; isRateLimit: boolean } {
  if (error instanceof ProviderError) {
    if (error.code === RATE_LIMIT) return { retryable: true, isRateLimit: true };
    if (error.code === SERVER_ERROR && error.statusCode && error.statusCode >= 500) {
      return { retryable: true, isRateLimit: false };
    }
    if (error.retryable) return { retryable: true, isRateLimit: error.code === RATE_LIMIT };
  }
  return { retryable: false, isRateLimit: false };
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): Promise<T> {
  let rateLimitAttempts = 0;
  let serverErrorAttempts = 0;

  while (true) {
    if (policy.signal?.aborted) {
      throw new ProviderError(ABORTED, 'Request was aborted');
    }

    try {
      return await operation();
    } catch (error) {
      if (policy.signal?.aborted) {
        throw new ProviderError(ABORTED, 'Request was aborted');
      }

      const { retryable, isRateLimit } = isRetryableError(error);
      if (!retryable) throw error;

      if (isRateLimit) {
        if (rateLimitAttempts >= policy.maxRateLimitRetries) throw error;
        rateLimitAttempts++;
        const delay = policy.baseDelayMs * rateLimitAttempts;
        await sleep(delay);
      } else {
        if (serverErrorAttempts >= policy.maxServerErrorRetries) throw error;
        serverErrorAttempts++;
        const delay = policy.baseDelayMs * Math.pow(2, serverErrorAttempts);
        await sleep(delay);
      }
    }
  }
}

export async function fetchWithRetry(
  fetchFn: () => Promise<Response>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetchFn();
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 429) {
        throw new ProviderError(RATE_LIMIT, `Rate limited: ${text}`, response.status, true);
      }
      if (response.status >= 500) {
        throw new ProviderError(SERVER_ERROR, `Server error ${response.status}: ${text}`, response.status, true);
      }
      throw new ProviderError(`HTTP_${response.status}`, `HTTP ${response.status}: ${text}`, response.status, false);
    }
    return response;
  }, policy);
}
