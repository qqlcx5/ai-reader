/**
 * OpenAI 兼容 API 适配器
 * 参考 doc/tasks/model-management.md 章节 4
 * 参考 doc/tasks/chat-with-doc.md 章节 3
 * 使用 eventsource-parser 解析 SSE（解决多字节字符在 chunks 截断时的乱码问题）
 */
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import type { ModelProviderConfig, ChatMessage } from '@/shared/types';

const PING_TIMEOUT = 30_000;
const CHAT_TIMEOUT = 60_000;

export interface ChatRequest {
  model: ModelProviderConfig;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatChunk {
  delta: string;
  done: boolean;
  raw?: unknown;
}

/**
 * 测试连接（Ping）
 * 参考 doc/tasks/model-management.md 章节 4
 */
export async function pingModel(model: ModelProviderConfig): Promise<{
  success: boolean;
  message?: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT);

  try {
    const url = joinUrl(model.baseUrl, '/chat/completions');
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: model.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
    });

    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        success: false,
        message: `HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    return { success: true };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, message: '请求超时（30s）' };
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 流式聊天
 * 参考 doc/tasks/chat-with-doc.md 章节 3
 */
export async function* streamChat(
  request: ChatRequest,
  options: { signal?: AbortSignal } = {}
): AsyncGenerator<ChatChunk> {
  const { model, messages, temperature = 0.7, maxTokens } = request;

  const url = joinUrl(model.baseUrl, '/chat/completions');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT);

  // 关联外部 signal
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${model.apiKey}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: model.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        stream: true,
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    throw new Error(
      `连接失败: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!res.ok || !res.body) {
    clearTimeout(timer);
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = createParser({
    onEvent: (event: EventSourceMessage) => {
      const data = event.data;
      if (data === '[DONE]') {
        // 由 reader 关闭驱动
        return;
      }
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          chunks.push({ delta, done: false, raw: json });
        }
      } catch (err) {
        // 忽略解析错误（可能 chunk 跨边界）
        console.warn('[streamChat] parse error:', err);
      }
    },
  });

  const chunks: ChatChunk[] = [];
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      parser.feed(buffer);
      buffer = '';

      // 抛出累积的 chunks
      while (chunks.length > 0) {
        const chunk = chunks.shift()!;
        yield chunk;
      }
    }
  } finally {
    clearTimeout(timer);
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }

  yield { delta: '', done: true };
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}
