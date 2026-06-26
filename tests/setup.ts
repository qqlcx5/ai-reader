import 'fake-indexeddb/auto';

// Mock chrome.runtime API
globalThis.chrome = {
  runtime: {
    sendMessage: vi.fn((msg, cb) => cb?.({ success: true })),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    connect: vi.fn(() => ({
      postMessage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      onDisconnect: { addListener: vi.fn() },
      name: 'test',
    })),
    onConnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: null,
    id: 'test-extension-id',
  },
  storage: {
    local: {
      get: vi.fn((key) => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    },
  },
  sidePanel: {
    open: vi.fn(() => Promise.resolve()),
  },
} as unknown as typeof chrome;
