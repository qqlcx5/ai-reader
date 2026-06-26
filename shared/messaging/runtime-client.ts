/**
 * Thin promise-based wrapper around `chrome.runtime` message
 * passing. Use this from any UI / content-script / background
 * context — it handles timeouts, request ids and error wrapping
 * uniformly.
 */

import type { Message, MessageResponse, MessageType } from './messages'
import { MESSAGE_TIMEOUT } from '@shared/constants'

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export class MessageTimeoutError extends Error {
  constructor(public readonly type: MessageType, timeoutMs: number) {
    super(`Message "${type}" timed out after ${timeoutMs}ms`)
    this.name = 'MessageTimeoutError'
  }
}

export class MessageChannelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MessageChannelError'
  }
}

/** Send a message to the background and wait for a typed response. */
export async function sendMessage<T extends MessageType, R = unknown>(
  message: Omit<Message<T>, 'requestId' | 'timestamp'>,
  timeoutMs: number = MESSAGE_TIMEOUT
): Promise<MessageResponse<R>> {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId()
    const fullMessage: Message<T> = {
      ...message,
      requestId,
      timestamp: Date.now(),
    }

    const timer = setTimeout(() => {
      reject(new MessageTimeoutError(message.type, timeoutMs))
    }, timeoutMs)

    try {
      chrome.runtime.sendMessage(fullMessage, (response: MessageResponse<R>) => {
        clearTimeout(timer)
        if (chrome.runtime.lastError) {
          reject(new MessageChannelError(chrome.runtime.lastError.message ?? 'unknown error'))
          return
        }
        resolve(response ?? { success: true })
      })
    } catch (err) {
      clearTimeout(timer)
      reject(err)
    }
  })
}

/** Fire-and-forget message (no response awaited). */
export function sendMessageAsync<T extends MessageType>(
  message: Omit<Message<T>, 'requestId' | 'timestamp'>
): void {
  const fullMessage: Message<T> = {
    ...message,
    requestId: generateRequestId(),
    timestamp: Date.now(),
  }
  try {
    chrome.runtime.sendMessage(fullMessage)
  } catch (err) {
    console.error('[messaging] sendMessageAsync failed:', err)
  }
}

/** Send a message to a specific tab's content script. */
export async function sendToTab<T extends MessageType, R = unknown>(
  tabId: number,
  message: Omit<Message<T>, 'requestId' | 'timestamp'>,
  timeoutMs: number = MESSAGE_TIMEOUT
): Promise<MessageResponse<R>> {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId()
    const fullMessage: Message<T> = {
      ...message,
      requestId,
      timestamp: Date.now(),
    }
    const timer = setTimeout(() => {
      reject(new MessageTimeoutError(message.type, timeoutMs))
    }, timeoutMs)
    try {
      chrome.tabs.sendMessage(tabId, fullMessage, (response: MessageResponse<R>) => {
        clearTimeout(timer)
        if (chrome.runtime.lastError) {
          reject(new MessageChannelError(chrome.runtime.lastError.message ?? 'no receiver'))
          return
        }
        resolve(response ?? { success: true })
      })
    } catch (err) {
      clearTimeout(timer)
      reject(err)
    }
  })
}

/** Listen for messages matching a specific type. */
export function onMessage<T extends MessageType>(
  type: T,
  handler: (
    message: Message<T>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: MessageResponse) => void
  ) => void | Promise<void> | boolean
): () => void {
  const listener = (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: MessageResponse) => void
  ): boolean | void => {
    if (!message || message.type !== type) return
    const result = handler(message as Message<T>, sender, sendResponse)
    if (result instanceof Promise) {
      result
        .then((handled) => {
          if (handled === false) return
          try {
            sendResponse({ success: true })
          } catch {
            // already responded
          }
        })
        .catch((err) => {
          try {
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            })
          } catch {
            // already responded
          }
        })
      return true // keep channel open
    }
    return
  }
  chrome.runtime.onMessage.addListener(listener)
  return () => chrome.runtime.onMessage.removeListener(listener)
}

/** Broadcast a message to all tabs and the runtime. */
export function broadcast<T extends MessageType>(
  message: Omit<Message<T>, 'requestId' | 'timestamp'>
): void {
  const fullMessage: Message<T> = {
    ...message,
    requestId: generateRequestId(),
    timestamp: Date.now(),
  }
  try {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id !== undefined) {
          try {
            chrome.tabs.sendMessage(tab.id, fullMessage)
          } catch {
            // content script may not be loaded
          }
        }
      }
    })
  } catch (err) {
    console.error('[messaging] broadcast failed:', err)
  }
  try {
    chrome.runtime.sendMessage(fullMessage)
  } catch {
    // no listener
  }
}
