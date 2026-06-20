import type { StorageLike } from 'pinia-plugin-persistedstate';
import type { PersistedStoreWrapper } from '@/modules/storage/types';

/**
 * Pinia persistedstate storage adapter backed by chrome.storage.local.
 *
 * Each persisted store has a stable key (see STORE_KEYS in modules/storage/types.ts).
 * The wrapper stores a version number and a timestamp so future migrations can
 * detect old payloads and upgrade them.
 */

const STORAGE_VERSION = 1;

export function chromeStorageLocal(key: string) {
  return {
    async getItem(name: string): Promise<string | null> {
      const raw = await chrome.storage.local.get(name);
      const wrapper = raw[name] as PersistedStoreWrapper<unknown> | undefined;
      if (!wrapper) return null;
      return JSON.stringify(wrapper.data);
    },
    async setItem(name: string, value: string): Promise<void> {
      const data = JSON.parse(value);
      const wrapper: PersistedStoreWrapper<unknown> = {
        version: STORAGE_VERSION,
        data,
        updatedAt: Date.now(),
      };
      await chrome.storage.local.set({ [name]: wrapper });
    },
    async removeItem(name: string): Promise<void> {
      await chrome.storage.local.remove(name);
    },
  };
}

export function chromeStorageSession(key: string) {
  return {
    async getItem(name: string): Promise<string | null> {
      const raw = await chrome.storage.session.get(name);
      const wrapper = raw[name] as PersistedStoreWrapper<unknown> | undefined;
      if (!wrapper) return null;
      return JSON.stringify(wrapper.data);
    },
    async setItem(name: string, value: string): Promise<void> {
      const data = JSON.parse(value);
      const wrapper: PersistedStoreWrapper<unknown> = {
        version: STORAGE_VERSION,
        data,
        updatedAt: Date.now(),
      };
      await chrome.storage.session.set({ [name]: wrapper });
    },
    async removeItem(name: string): Promise<void> {
      await chrome.storage.session.remove(name);
    },
  };
}

export function makeChromeStorageOptions(key: string): { storage: StorageLike } {
  return {
    storage: chromeStorageLocal(key) as unknown as StorageLike,
  };
}

export { STORAGE_VERSION };
