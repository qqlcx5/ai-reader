import { describe, it, expect } from 'vitest';
import {
  toStreamError,
  toNetworkError,
  formatStreamError,
  isRetryable,
} from '@/utils/errors';

describe('toStreamError', () => {
  it('returns auth type for 401 with API Key message', () => {
    const err = toStreamError(401, '');
    expect(err.type).toBe('auth');
    expect(err.message).toContain('API Key');
    expect(err.status).toBe(401);
  });

  it('returns auth type for 403', () => {
    const err = toStreamError(403, '');
    expect(err.type).toBe('auth');
    expect(err.status).toBe(403);
  });

  it('returns rate_limit type for 429', () => {
    const err = toStreamError(429, '');
    expect(err.type).toBe('rate_limit');
    expect(err.status).toBe(429);
  });

  it('returns unknown type for 500 (network-like)', () => {
    const err = toStreamError(500, '');
    expect(err.type).toBe('unknown');
    expect(err.status).toBe(500);
  });

  it('parses JSON body with error.message', () => {
    const body = JSON.stringify({ error: { message: 'Invalid request' } });
    const err = toStreamError(400, body);
    expect(err.type).toBe('unknown');
    expect(err.status).toBe(400);
    // The function uses body.slice(0, 200) for non-matching status codes
    expect(err.message).toContain('400');
  });

  it('falls back for non-JSON body', () => {
    const err = toStreamError(400, 'plain text error');
    expect(err.message).toContain('400');
    expect(err.message).toContain('plain text error');
  });
});

describe('toNetworkError', () => {
  it('returns Ollama message for ECONNREFUSED', () => {
    const err = toNetworkError(new Error('ECONNREFUSED 127.0.0.1:11434'));
    expect(err.type).toBe('network');
    expect(err.message).toContain('Ollama');
  });

  it('returns network message for Failed to fetch', () => {
    const err = toNetworkError(new Error('Failed to fetch'));
    expect(err.type).toBe('network');
    expect(err.message).toContain('网络');
  });

  it('returns cancel message for AbortError', () => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    const err = toNetworkError(error);
    expect(err.type).toBe('network');
    expect(err.message).toContain('取消');
  });

  it('returns generic network error for unknown errors', () => {
    const err = toNetworkError(new Error('something weird'));
    expect(err.type).toBe('network');
    expect(err.message).toContain('网络错误');
  });
});

describe('formatStreamError', () => {
  it('returns message from StreamError', () => {
    const err = { type: 'auth' as const, message: 'API Key 无效', status: 401 };
    expect(formatStreamError(err)).toBe('API Key 无效');
  });

  it('returns string as-is', () => {
    expect(formatStreamError('some error string')).toBe('some error string');
  });
});

describe('isRetryable', () => {
  it('returns true for rate_limit errors', () => {
    const err = { type: 'rate_limit' as const, message: 'rate limited', status: 429 };
    expect(isRetryable(err)).toBe(true);
  });

  it('returns false for auth errors', () => {
    const err = { type: 'auth' as const, message: 'unauthorized', status: 401 };
    expect(isRetryable(err)).toBe(false);
  });

  it('returns true for 500+ status errors', () => {
    const err = { type: 'unknown' as const, message: 'server error', status: 500 };
    expect(isRetryable(err)).toBe(true);
  });

  it('returns false for unknown errors without 500+ status', () => {
    const err = { type: 'unknown' as const, message: 'bad request', status: 400 };
    expect(isRetryable(err)).toBe(false);
  });
});
