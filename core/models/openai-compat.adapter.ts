export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onDelta: (content: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

/** 测试连接（Ping） */
export async function ping(
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<{ success: boolean; latency: number; error?: string }> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, latency, error: `${response.status}: ${errorText}` };
    }

    return { success: true, latency };
  } catch (err) {
    clearTimeout(timeout);
    const latency = Date.now() - startTime;
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, latency, error: '超时（30s）' };
    }
    return { success: false, latency, error: String(err) };
  }
}

/** 流式聊天 - 使用回调方式 */
export async function streamChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  systemPrompt?: string,
): Promise<void> {
  const allMessages: ChatMessage[] = [];
  if (systemPrompt) {
    allMessages.push({ role: 'system', content: systemPrompt });
  }
  allMessages.push(...messages);

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  try {
    console.log('[ReadChat] Calling API:', url);
    console.log('[ReadChat] Model:', model);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: allMessages,
        stream: true,
      }),
    });

    console.log('[ReadChat] Response status:', response.status);
    console.log('[ReadChat] Response content-type:', response.headers.get('content-type'));

    if (!response.ok) {
      const errorText = await response.text();
      // 检查是否返回了 HTML 而不是 JSON
      if (errorText.includes('<html') || errorText.includes('<!DOCTYPE')) {
        callbacks.onError(`API 返回了网页而不是 JSON。请检查 Base URL 是否正确。\n请求 URL: ${url}\n状态码: ${response.status}`);
      } else {
        callbacks.onError(`${response.status}: ${errorText.slice(0, 500)}`);
      }
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const htmlText = await response.text();
      callbacks.onError(`API 返回了 HTML 而不是 JSON 流。请检查 Base URL 配置。\n请求 URL: ${url}\n响应: ${htmlText.slice(0, 200)}`);
      return;
    }

    if (!response.body) {
      callbacks.onError('Empty response body');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (!trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          callbacks.onDone();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            callbacks.onDelta(content);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    // Stream ended without [DONE]
    callbacks.onDone();
  } catch (err) {
    callbacks.onError(String(err));
  }
}
