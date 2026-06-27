// ============================================================
// Unified Message Protocol for SuperBrain Extension
// ============================================================

import type { MessageAction, MessageEnvelope } from './domain';

const ENVELOPE_VERSION = 1;

function wrap<T>(type: string, payload: T): MessageEnvelope<T> {
  return { type, payload, timestamp: Date.now() };
}

// ---- Send to Background (from Content Script / Popup / Sidepanel) ----

export async function sendMessageToBackground<T extends MessageAction>(
  message: T,
): Promise<unknown> {
  const envelope = wrap(message.action, message.data);
  return chrome.runtime.sendMessage(envelope);
}

// ---- Send to Content Script (from Background / Popup) ----

export async function sendMessageToContentScript<T = unknown>(
  tabId: number,
  type: string,
  payload: T,
): Promise<unknown> {
  const envelope = wrap(type, payload);
  return chrome.tabs.sendMessage(tabId, envelope);
}

// ---- Register Listener (always return true for async) ----

export function onMessage<T = unknown>(
  type: string,
  handler: (
    payload: T,
    sender: chrome.runtime.MessageSender,
  ) => Promise<unknown> | unknown,
): () => void {
  const listener = (
    message: MessageEnvelope<T>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean => {
    if (message && message.type === type) {
      const result = handler(message.payload, sender);
      if (result instanceof Promise) {
        result.then(sendResponse).catch((err) => {
          console.error(`[SuperBrain] Message handler error (${type}):`, err);
          sendResponse({ error: String(err) });
        });
      } else {
        sendResponse(result);
      }
      return true; // keep channel open for async
    }
    return false;
  };

  chrome.runtime.onMessage.addListener(listener);

  return () => {
    chrome.runtime.onMessage.removeListener(listener);
  };
}

// ---- Content Script Ready Detection ----

let generationCounter = 0;

export function incrementGeneration(): number {
  generationCounter += 1;
  return generationCounter;
}

export function getGeneration(): number {
  return generationCounter;
}

export function resetGeneration(): void {
  generationCounter = 0;
}
