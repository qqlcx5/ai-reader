import { watch, type Ref } from 'vue';
import type { StoreDefinition, Store } from 'pinia';
import { STORE_KEYS, type PersistedStoreId } from '@/modules/storage/types';
import { chromeStorageLocal } from './chrome-storage';

/**
 * Cross-entry sync helpers for Pinia + chrome.storage.local.
 *
 * pinia-plugin-persistedstate writes store changes to chrome.storage.local.
 * These helpers listen to chrome.storage.onChanged and hydrate the matching
 * store when another entry (popup, side panel, options) writes a new value.
 */

type PickPaths<T> = Array<keyof T & string>;

export async function hydrateFromStorage<K extends string>(
  storeId: PersistedStoreId,
  store: Store,
  paths: PickPaths<Store>,
): Promise<void> {
  const key = STORE_KEYS[storeId];
  const raw = await chromeStorageLocal(key).getItem(key);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    for (const path of paths) {
      if (path in data && path in store) {
        (store[path as keyof typeof store] as Ref<unknown>).value = data[path];
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[sync] Failed to hydrate ${storeId}`, err);
  }
}

export function useStorageSync<K extends string>(
  storeId: PersistedStoreId,
  storeDefinition: StoreDefinition<string, {}, {}, {}>,
  paths: PickPaths<Store>,
): void {
  const key = STORE_KEYS[storeId];

  const listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => {
    if (area !== 'local') return;
    const change = changes[key];
    if (!change || !change.newValue) return;
    const store = storeDefinition();
    const data = (change.newValue as { data?: Record<string, unknown> }).data;
    if (!data) return;
    for (const path of paths) {
      if (path in data && path in store) {
        (store[path as keyof typeof store] as Ref<unknown>).value = data[path];
      }
    }
  };

  chrome.storage.onChanged.addListener(listener);
}

export function watchAndSync<T>(store: Store, key: string, ref: Ref<T>): void {
  watch(ref, async (value) => {
    await chrome.storage.local.set({ [key]: value });
  });
}
