import type { StreamError } from '@/utils/llm/types';

/**
 * Construct a structured StreamError from an HTTP response.
 * Attempts to parse the body as JSON to extract a meaningful error message.
 */
export function toStreamError(status: number, body: string): StreamError {
  let message = '';

  // Try to extract message from JSON body (OpenAI, Anthropic, Gemini formats)
  try {
    const parsed = JSON.parse(body);
    message =
      parsed.error?.message ||
      parsed.error?.detail ||
      parsed.error ||
      parsed.message ||
      '';
  } catch {
    // Not JSON, use raw body (truncate if too long)
    message = body.length > 200 ? body.slice(0, 200) + '...' : body;
  }

  if (status === 401) {
    return { type: 'auth', message: message || 'API Key 无效，请检查设置', status };
  }
  if (status === 403) {
    return {
      type: 'auth',
      message: message || '访问被拒绝，API Key 可能没有权限访问此模型',
      status,
    };
  }
  if (status === 429) {
    return {
      type: 'rate_limit',
      message: '请求过于频繁，请稍后重试',
      status,
    };
  }
  if (status >= 500) {
    return {
      type: 'network',
      message: '服务暂时不可用，请稍后重试',
      status,
    };
  }
  return {
    type: 'unknown',
    message: message || `请求失败 (${status})`,
    status,
  };
}

/**
 * Construct a StreamError from a network/fetch exception.
 */
export function toNetworkError(err: Error): StreamError {
  const msg = err.message || '';

  if (msg.includes('ECONNREFUSED') || msg.includes('Failed to fetch') && msg.includes('localhost')) {
    return {
      type: 'network',
      message: '无法连接本地模型服务，是否已启动 Ollama / LM Studio？',
    };
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('net::ERR')) {
    return {
      type: 'network',
      message: '无法连接服务器，请检查网络连接',
    };
  }
  if (msg.includes('abort') || msg.includes('AbortError')) {
    return {
      type: 'unknown',
      message: '请求已取消',
    };
  }
  return {
    type: 'unknown',
    message: msg || '未知错误',
  };
}

/**
 * Format a StreamError into a user-friendly display string.
 */
export function formatStreamError(err: StreamError | string): string {
  if (typeof err === 'string') return err;
  return err.message;
}

/**
 * Check if a StreamError is retryable.
 */
export function isRetryable(err: StreamError): boolean {
  return err.type === 'rate_limit' || (err.type === 'network' && !err.message.includes('本地模型'));
}
