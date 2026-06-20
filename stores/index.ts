import { createPinia as createPiniaOriginal, type Pinia } from 'pinia';
import { createPersistedState } from 'pinia-plugin-persistedstate';
import type { PersistedStoreId } from '@/modules/storage';

const PERSISTED_STORE_IDS: PersistedStoreId[] = ['ui', 'context', 'settings', 'conversation'];
const STORAGE_PREFIX = 'pinia-';

function isChromeStorageAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);
}

/**
 * Synchronous in-memory cache backed by chrome.storage.local.
 *
 * pinia-plugin-persistedstate requires a synchronous StorageLike API. We load
 * chrome.storage.local once at startup, keep a synchronous cache, and flush
 * changes asynchronously. Cross-entry updates are applied via the sync plugin.
 */
class ChromeStorageCache {
  private cache = new Map<string, string>();

  async load(): Promise<void> {
    if (!isChromeStorageAvailable()) return;
    const keys = PERSISTED_STORE_IDS.map((id) => `${STORAGE_PREFIX}${id}`);
    const result = await chrome.storage.local.get(keys);
    for (const key of keys) {
      const value = result[key];
      if (typeof value === 'string') {
        this.cache.set(key, value);
      }
    }
  }

  getItem(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    if (!isChromeStorageAvailable()) return;
    chrome.storage.local.set({ [key]: value }).catch(() => {
      /* best-effort */
    });
  }

  removeItem(key: string): void {
    if (!this.cache.has(key)) return;
    this.cache.delete(key);
    if (!isChromeStorageAvailable()) return;
    chrome.storage.local.remove(key).catch(() => {
      /* best-effort */
    });
  }

  updateFromExternal(key: string, value: string): void {
    this.cache.set(key, value);
  }
}

const chromeStorageCache = new ChromeStorageCache();

/**
 * Pinia plugin that listens to chrome.storage.onChanged and rehydrates the
 * matching store from the updated cache. This keeps popup, side-panel, and
 * options pages in sync.
 */
function chromeStorageSyncPlugin(context: { store: any }) {
  const { store } = context;
  const key = `${STORAGE_PREFIX}${store.$id}`;
  if (!isChromeStorageAvailable()) return;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const change = changes[key];
    if (!change || change.newValue === undefined) return;
    const newValue = change.newValue as string;
    if (chromeStorageCache.getItem(key) === newValue) return;
    chromeStorageCache.updateFromExternal(key, newValue);
    store.$hydrate();
  });
}

export async function createPinia(): Promise<Pinia> {
  await chromeStorageCache.load();
  const pinia = createPiniaOriginal();
  pinia.use(
    createPersistedState({
      storage: {
        getItem: (key) => chromeStorageCache.getItem(key),
        setItem: (key, value) => chromeStorageCache.setItem(key, value),
      },
    }),
  );
  pinia.use(chromeStorageSyncPlugin);
  return pinia;
}

export function resetChromeStorageCache(): void {
  chromeStorageCache['cache'].clear();
}

export { STORAGE_PREFIX };
