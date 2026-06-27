import { vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import 'fake-indexeddb/auto'

// Ensure Web Crypto API is available in jsdom (needed for AES-GCM)
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  ;(globalThis as any).crypto = webcrypto as unknown as Crypto
}

// Mock chrome API for jsdom environment
if (typeof globalThis.chrome === 'undefined') {
  const localStore = new Map<string, any>()
  const syncStore = new Map<string, any>()

  function makeStorage(store: Map<string, any>) {
    return {
      get: vi.fn(async (keys: string | string[] | null) => {
        if (keys === null) {
          const result: Record<string, any> = {}
          store.forEach((v, k) => { result[k] = v })
          return result
        }
        const keyList = Array.isArray(keys) ? keys : [keys]
        const result: Record<string, any> = {}
        keyList.forEach((k) => { result[k] = store.get(k) })
        return result
      }),
      set: vi.fn(async (items: Record<string, any>) => {
        Object.entries(items).forEach(([k, v]) => store.set(k, v))
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys]
        keyList.forEach((k) => store.delete(k))
      }),
    }
  }

  ;(globalThis as any).chrome = {
    storage: {
      local: makeStorage(localStore),
      sync: makeStorage(syncStore),
    },
    runtime: {
      id: 'test-extension-id',
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      getURL: vi.fn((path: string) => `chrome-extension://mock/${path}`),
    },
    tabs: {
      sendMessage: vi.fn(),
      query: vi.fn(async () => []),
    },
  }
}
