/**
 * 跨上下文通信客户端
 * 参考 doc/tasks/foundation.md 章节 5
 * 参考 chrome-extensions skill 规则 #5：异步 onMessage 必须 return true
 * 参考 obsidian-clipper/browser-polyfill.ts 风格
 */
import type { MessageEnvelope, MessageMap, MessageResponse } from '../types';

const REQUEST_TIMEOUT = 30_000; // 30s

/**
 * 发送一次性请求到 background，等待响应
 */
export async function sendMessage<T extends keyof MessageMap>(
  type: T,
  payload: MessageMap[T]
): Promise<MessageResponse<unknown>> {
  const envelope: MessageEnvelope<MessageMap[T]> = {
    type,
    payload,
    timestamp: Date.now(),
  };

  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage(envelope),
      new Promise<MessageResponse<unknown>>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
      ),
    ]);
    return response as MessageResponse<unknown>;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 监听消息（不返回响应）
 * ⚠️ chrome-extensions 规则 #5：如果异步处理，必须 return true
 */
export function onMessage<T = unknown>(
  handler: (
    envelope: MessageEnvelope<T>,
    sender: chrome.runtime.MessageSender
  ) => void | Promise<void> | MessageResponse | Promise<MessageResponse> | unknown | Promise<unknown>
): () => void {
  const listener = (
    message: MessageEnvelope<T>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    // 判断是否需要返回 true（保持通道开放给异步响应）
    const result = handler(message, sender);
    if (result instanceof Promise) {
      // 异步 - 必须 return true
      result
        .then((res) => sendResponse(res))
        .catch((err) => {
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return true;
    }
    if (result !== undefined) {
      // 同步返回值 - 直接响应
      sendResponse(result);
    }
    // 如果 handler 不返回也不发响应，return undefined（false）
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

/**
 * 长连接（适合 SSE 流式转发）
 * 参考 doc/tasks/chat-with-doc.md 章节 3
 */
export interface Port {
  name: string;
  postMessage: (msg: unknown) => void;
  onMessage: chrome.runtime.Port['onMessage'];
  onDisconnect: chrome.runtime.Port['onDisconnect'];
  disconnect: () => void;
}

export function connectPort(name: string): Port | null {
  try {
    return chrome.runtime.connect({ name }) as Port;
  } catch {
    return null;
  }
}

/**
 * 监听长连接（background 端）
 */
export function onPortConnect(
  handler: (port: Port) => void
): () => void {
  const listener = (port: chrome.runtime.Port) => {
    handler(port as unknown as Port);
  };
  chrome.runtime.onConnect.addListener(listener);
  return () => chrome.runtime.onConnect.removeListener(listener);
}
