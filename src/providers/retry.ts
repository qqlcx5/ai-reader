/**
 * Retry logic with exponential backoff for rate limits and server errors.
 *
 * Error handling strategy per design-03-provider-client.md §10:
 * - API Key missing: fail immediately (no retry)
 * - Network timeout (60s): retry 1 time
 * - 429 Rate Limit: read Retry-After, delay then retry up to 3 times
 * - 5xx Server Error: exponential backoff, up to 3 times
 * - User Abort: terminate immediately
 */

import { ProviderError, RATE_LIMIT, SERVER_ERROR, ABORTED } from './types';

// ─── Types ────────────────────────────────────────────────────────────

export interface RetryPolicy {
  maxRateLimitRetries: number;
  maxServerErrorRetries: number;
  baseDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRateLimitRetries: 3,
  maxServerErrorRetries: 3,
  baseDelayMs: 1000,
};

// ─── Helpers ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RetryableResult {
  retryable: boolean;
  isRateLimit: boolean;
}

function classifyError(error: unknown): RetryableResult {
  if (error instanceof ProviderError) {
    if (error.code === RATE_LIMIT) return { retryable: true, isRateLimit: true };
    if (error.code === SERVER_ERROR) return { retryable: true, isRateLimit: false };
    if (error.retryable) return { retryable: true, isRateLimit: error.code === RATE_LIMIT };
  }
  return { retryable: false, isRateLimit: false };
}

// ─── Core ─────────────────────────────────────────────────────────────

/**
 * Wraps a fetch call with retry logic.
 *
 * Non-retryable errors (4xx except 429, parse errors, aborts) propagate immediately.
 * Rate limits use linear backoff; server errors use exponential backoff.
 */
export async function fetchWithRetry(
  fetchFn: () => Promise<Response>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  signal?: AbortSignal,
): Promise<Response> {
  let rateLimitAttempts = 0;
  let serverErrorAttempts = 0;

  while (true) {
    if (signal?.aborted) {
      throw new ProviderError(ABORTED, 'Request was aborted');
    }

    try {
      const response = await fetchFn();

      if (!response.ok) {
        const text = await response.text().catch(() => '');

        if (response.status === 429) {
          const error = new ProviderError(RATE_LIMIT, `Rate limited: ${text}`, response.status, true);
          if (rateLimitAttempts >= policy.maxRateLimitRetries) throw error;
          rateLimitAttempts++;
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : policy.baseDelayMs * rateLimitAttempts;
          await sleep(delay);
          continue;
        }

        if (response.status >= 500) {
          const error = new ProviderError(SERVER_ERROR, `Server error ${response.status}: ${text}`, response.status, true);
          if (serverErrorAttempts >= policy.maxServerErrorRetries) throw error;
          serverErrorAttempts++;
          const delay = policy.baseDelayMs * Math.pow(2, serverErrorAttempts);
          await sleep(delay);
          continue;
        }

        throw new ProviderError(
          `HTTP_${response.status}`,
          `HTTP ${response.status}: ${text}`,
          response.status,
          false,
        );
      }

      return response;
    } catch (error) {
      if (signal?.aborted) {
        throw new ProviderError(ABORTED, 'Request was aborted');
      }

      if (error instanceof ProviderError) {
        // Already classified above, re-check if we should retry
        const { retryable, isRateLimit } = classifyError(error);
        if (!retryable) throw error;

        if (isRateLimit) {
          rateLimitAttempts++;
          if (rateLimitAttempts > policy.maxRateLimitRetries) throw error;
          await sleep(policy.baseDelayMs * rateLimitAttempts);
        } else {
          serverErrorAttempts++;
          if (serverErrorAttempts > policy.maxServerErrorRetries) throw error;
          await sleep(policy.baseDelayMs * Math.pow(2, serverErrorAttempts));
        }
        continue;
      }

      // Network errors (TypeError, etc.) — retry once
      if (serverErrorAttempts >= 1) throw error;
      serverErrorAttempts++;
      await sleep(policy.baseDelayMs);
    }
  }
}
