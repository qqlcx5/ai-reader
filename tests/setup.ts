/**
 * Vitest setup.
 *
 * Stubs the `chrome.*` API surface used by the modules under
 * test so that we can run them in jsdom without the extension
 * host. Real Chrome behaviour is covered by manual smoke tests.
 */

import { vi } from 'vitest'

const messageListeners: Array<(message: unknown, sender: unknown, sendResponse: (r?: unknown) => void) => unknown> = []

const chromeStub = {
  runtime: {
    sendMessage: vi.fn((_msg: unknown, cb?: (r: unknown) => void) => {
      if (cb) cb({ success: true })
      return Promise.resolve({ success: true })
    }),
    onMessage: {
      addListener: vi.fn((fn: typeof messageListeners[number]) => {
        messageListeners.push(fn)
      }),
      removeListener: vi.fn((fn: typeof messageListeners[number]) => {
        const i = messageListeners.indexOf(fn)
        if (i >= 0) messageListeners.splice(i, 1)
      }),
    },
    onMessageExternal: { addListener: vi.fn() },
    lastError: undefined as chrome.runtime.LastError | undefined,
    getURL: vi.fn((p: string) => `chrome-extension://test/${p}`),
    id: 'test-extension-id',
  },
  tabs: {
    query: vi.fn(async () => []),
    sendMessage: vi.fn(async () => ({ success: true })),
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
  },
  storage: {
    local: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
    },
  },
  sidePanel: {
    open: vi.fn(async () => undefined),
    setOptions: vi.fn(async () => undefined),
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: { addListener: vi.fn() },
  },
  notifications: {
    create: vi.fn(),
  },
  commands: {
    onCommand: { addListener: vi.fn() },
  },
}

;(globalThis as unknown as { chrome: typeof chrome }).chrome = chromeStub as unknown as typeof chrome

// Reset between tests
afterEach(() => {
  vi.clearAllMocks()
  messageListeners.length = 0
})
