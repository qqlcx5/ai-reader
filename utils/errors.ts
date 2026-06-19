import type { StreamError } from '@/utils/llm/types';

/**
 * Construct a structured StreamError from an HTTP response.
 */
export function toStreamError(status: number, body: string): StreamError {
  const base = { status };

  if (status === 401) {
    return { type: 'auth', message: 'API Key 无效，请检查设置', ...base };
  }

  if (status === 403) {
    return {
      type: 'auth',
      message: '访问被拒绝，API Key 可能没有权限访问此模型',
      ...base,
    };
  }

  if (status === 429) {
    return { type: 'rate_limit', message: '请求过于频繁，请稍后重试', ...base };
  }

  if (status >= 500) {
    return {
      type: 'unknown',
      message: '服务暂时不可用，请稍后重试',
      ...base,
    };
  }

  return {
    type: 'unknown',
    message: `请求失败 (${status}): ${body.slice(0, 200)}`,
    ...base,
  };
}

/**
 * Construct a structured StreamError from a network / fetch exception.
 */
export function toNetworkError(err: Error): StreamError {
  const msg = err.message ?? '';

  if (err.name === 'AbortError' || msg.includes('abort')) {
    return { type: 'network', message: '请求已取消' };
  }

  if (
    msg.includes('ECONNREFUSED') ||
    (msg.includes('localhost') && msg.includes('fetch'))
  ) {
    return {
      type: 'network',
      message: '无法连接本地模型服务，是否已启动 Ollama / LM Studio？',
    };
  }

  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return { type: 'network', message: '无法连接服务器，请检查网络连接' };
  }

  return { type: 'network', message: `网络错误: ${msg}` };
}

/**
 * Format a StreamError (or legacy string) into user-friendly display text.
 */
export function formatStreamError(err: StreamError | string): string {
  if (typeof err === 'string') return err;
  return err.message;
}

/**
 * Whether the error is worth retrying.
 */
export function isRetryable(err: StreamError): boolean {
  if (err.type === 'rate_limit') return true;
  if (err.status !== undefined && err.status >= 500) return true;
  return false;
}
