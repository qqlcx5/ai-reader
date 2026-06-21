import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, fetchWithRetry, DEFAULT_RETRY_POLICY } from '../retry';
import { ProviderError, RATE_LIMIT, SERVER_ERROR } from '../types';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result on first success', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    const result = await withRetry(operation, { ...DEFAULT_RETRY_POLICY, maxRateLimitRetries: 1 });
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new ProviderError(SERVER_ERROR, 'fail', 500, true))
      .mockResolvedValue('success');

    const promise = withRetry(operation, { ...DEFAULT_RETRY_POLICY, maxRateLimitRetries: 2, maxServerErrorRetries: 2, baseDelayMs: 10 });
    await vi.advanceTimersByTimeAsync(20);
    const result = await promise;
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries exceeded', async () => {
    const operation = vi.fn().mockRejectedValue(new ProviderError(SERVER_ERROR, 'fail', 500, true));
    const promise = withRetry(operation, { ...DEFAULT_RETRY_POLICY, maxRateLimitRetries: 0, maxServerErrorRetries: 0, baseDelayMs: 10 });
    await expect(promise).rejects.toThrow('fail');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 4xx (except 429)', async () => {
    const operation = vi.fn().mockRejectedValue(new ProviderError('HTTP_400', 'bad request', 400, false));
    await expect(withRetry(operation, { ...DEFAULT_RETRY_POLICY, maxRateLimitRetries: 2 })).rejects.toThrow('bad request');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 rate limit', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new ProviderError(RATE_LIMIT, 'rate limited', 429, true))
      .mockResolvedValue('success');

    const promise = withRetry(operation, { ...DEFAULT_RETRY_POLICY, maxRateLimitRetries: 2, baseDelayMs: 10 });
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('aborts immediately when signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const operation = vi.fn().mockResolvedValue('success');
    const opts = { ...DEFAULT_RETRY_POLICY, signal: controller.signal };
    await expect(withRetry(operation, opts)).rejects.toThrow('Request was aborted');
  });

  it('fetchWithRetry returns response on success', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    const fetchFn = vi.fn().mockResolvedValue(mockResponse);
    const result = await fetchWithRetry(fetchFn, { ...DEFAULT_RETRY_POLICY, maxRateLimitRetries: 1 });
    expect(result.status).toBe(200);
  });

  it('fetchWithRetry retries on 500', async () => {
    const failResponse = new Response('error', { status: 500 });
    const okResponse = new Response('ok', { status: 200 });
    const fetchFn = vi.fn().mockResolvedValueOnce(failResponse).mockResolvedValueOnce(okResponse);

    const promise = fetchWithRetry(fetchFn, { ...DEFAULT_RETRY_POLICY, maxRateLimitRetries: 2, maxServerErrorRetries: 2, baseDelayMs: 10 });
    await vi.advanceTimersByTimeAsync(20);
    const result = await promise;
    expect(result.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  }, 10000);
});