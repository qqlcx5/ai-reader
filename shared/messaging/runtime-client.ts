import type { ExtensionMessage, MessageType } from './messages';

type MessageHandler = (message: ExtensionMessage, sender: chrome.runtime.MessageSender) => void | Promise<unknown>;

/** 发送消息到 Background，返回 Promise */
export function sendMessage<T = unknown>(message: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });
}

/** 监听消息，支持异步 handler */
export function onMessage(handler: MessageHandler): () => void {
  const listener = (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean => {
    const result = handler(message, sender);
    if (result instanceof Promise) {
      result
        .then(sendResponse)
        .catch((err) => sendResponse({ error: String(err) }));
      return true; // keep channel open for async
    }
    if (result !== undefined) {
      sendResponse(result);
    }
    return false;
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

/** 建立长连接 */
export function connectPort(name: string): chrome.runtime.Port {
  return chrome.runtime.connect({ name });
}

/** 监听长连接 */
export function onConnect(
  name: string,
  handler: (port: chrome.runtime.Port) => void,
): () => void {
  const listener = (port: chrome.runtime.Port) => {
    if (port.name === name) {
      handler(port);
    }
  };

  chrome.runtime.onConnect.addListener(listener);
  return () => chrome.runtime.onConnect.removeListener(listener);
}
