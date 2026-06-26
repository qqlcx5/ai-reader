import type { Message, MessageType, MessageResponse } from '../types';
import { MESSAGE_TIMEOUT } from '../constants';

// Generate unique request ID
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Send message and wait for response
export async function sendMessage<T extends MessageType, R = any>(
  message: Omit<Message<T>, 'requestId' | 'timestamp'>
): Promise<MessageResponse<R>> {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();
    const fullMessage: Message<T> = {
      ...message,
      requestId,
      timestamp: Date.now(),
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Message timeout: ${message.type}`));
    }, MESSAGE_TIMEOUT);

    function handleResponse(response: MessageResponse<R>) {
      cleanup();
      if (response && typeof response === 'object') {
        resolve(response);
      } else {
        resolve({ success: true, data: response as R });
      }
    }

    function cleanup() {
      clearTimeout(timeout);
    }

    try {
      chrome.runtime.sendMessage(fullMessage, handleResponse);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

// Send message without waiting for response (fire and forget)
export function sendMessageAsync<T extends MessageType>(
  message: Omit<Message<T>, 'requestId' | 'timestamp'>
): void {
  const fullMessage: Message<T> = {
    ...message,
    requestId: generateRequestId(),
    timestamp: Date.now(),
  };

  try {
    chrome.runtime.sendMessage(fullMessage);
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

// Listen for messages
export function onMessage<T extends MessageType>(
  type: T,
  handler: (
    message: Message<T>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => void | Promise<void>
): () => void {
  const listener = (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    if (message.type === type) {
      const result = handler(message as Message<T>, sender, sendResponse);
      if (result instanceof Promise) {
        result
          .then(() => {
            // If handler didn't call sendResponse, send success
            try {
              sendResponse({ success: true });
            } catch {
              // Already responded
            }
          })
          .catch((error) => {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        return true; // Keep channel open for async
      }
    }
    return false;
  };

  chrome.runtime.onMessage.addListener(listener);

  // Return cleanup function
  return () => {
    chrome.runtime.onMessage.removeListener(listener);
  };
}

// Listen for messages from specific context
export function onMessageFromContext<T extends MessageType>(
  type: T,
  context: 'background' | 'content' | 'popup' | 'sidepanel',
  handler: (
    message: Message<T>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => void | Promise<void>
): () => void {
  return onMessage(type, (message, sender, sendResponse) => {
    // Determine sender context from sender info
    const senderContext = getSenderContext(sender);
    if (senderContext === context) {
      return handler(message, sender, sendResponse);
    }
    return undefined;
  });
}

function getSenderContext(sender: chrome.runtime.MessageSender): string {
  if (!sender.tab) return 'background';
  if (sender.url?.includes('sidepanel.html')) return 'sidepanel';
  if (sender.url?.includes('popup.html')) return 'popup';
  if (sender.url?.includes('options.html')) return 'options';
  return 'content';
}

// Send message to content script of specific tab
export async function sendToContentScript<T extends MessageType, R = any>(
  tabId: number,
  message: Omit<Message<T>, 'requestId' | 'timestamp'>
): Promise<MessageResponse<R>> {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();
    const fullMessage: Message<T> = {
      ...message,
      requestId,
      timestamp: Date.now(),
    };

    const timeout = setTimeout(() => {
      reject(new Error(`Content script message timeout: ${message.type}`));
    }, MESSAGE_TIMEOUT);

    try {
      chrome.tabs.sendMessage(tabId, fullMessage, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response || { success: true });
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// Send message to background script
export async function sendToBackground<T extends MessageType, R = any>(
  message: Omit<Message<T>, 'requestId' | 'timestamp'>
): Promise<MessageResponse<R>> {
  return sendMessage(message);
}

// Broadcast message to all contexts
export function broadcastMessage<T extends MessageType>(
  message: Omit<Message<T>, 'requestId' | 'timestamp'>
): void {
  const fullMessage: Message<T> = {
    ...message,
    requestId: generateRequestId(),
    timestamp: Date.now(),
  };

  // Send to all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        try {
          chrome.tabs.sendMessage(tab.id, fullMessage);
        } catch {
          // Tab may not have content script
        }
      }
    });
  });

  // Send to runtime (background)
  try {
    chrome.runtime.sendMessage(fullMessage);
  } catch {
    // Background may not be listening
  }
}
