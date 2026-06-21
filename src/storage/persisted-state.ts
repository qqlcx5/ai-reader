/**
 * Persisted State — chrome.storage.local read/write with Pinia sync
 *
 * Small state (UI, context, settings) is serialized to chrome.storage.local.
 * When one extension entry (Popup, Side Panel, Options) writes to storage,
 * chrome.storage.onChanged fires to sync state across other entries.
 *
 * Based on design-07-storage-data.md §4.
 */

import type {
  Settings,
  UiState,
  CurrentContext,
  PersistedStoreWrapper,
  PersistedStoreId,
} from './types';
import { STORE_KEYS, defaultSettings } from './types';

// ─── Read / Write ────────────────────────────────────────────────────

function wrap<T>(data: T): PersistedStoreWrapper<T> {
  return { version: 1, data, updatedAt: Date.now() };
}

function unwrap<T>(wrapper: PersistedStoreWrapper<T> | undefined, fallback: T): T {
  return wrapper?.data ?? fallback;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({
    [STORE_KEYS.settings]: wrap(settings),
  });
}

export async function loadSettings(): Promise<Settings> {
  const key = STORE_KEYS.settings;
  const stored = await chrome.storage.local.get(key);
  return unwrap(stored[key], defaultSettings);
}

export async function saveUiState(state: UiState): Promise<void> {
  await chrome.storage.local.set({
    [STORE_KEYS.ui]: wrap(state),
  });
}

export async function loadUiState(): Promise<UiState> {
  const key = STORE_KEYS.ui;
  const stored = await chrome.storage.local.get(key);
  return unwrap(stored[key], getDefaultUiState());
}

export async function saveContext(context: CurrentContext): Promise<void> {
  await chrome.storage.local.set({
    [STORE_KEYS.context]: wrap(context),
  });
}

export async function loadContext(): Promise<CurrentContext | null> {
  const key = STORE_KEYS.context;
  const stored = await chrome.storage.local.get(key);
  return stored[key]?.data ?? null;
}

// ─── Defaults ────────────────────────────────────────────────────────

function getDefaultUiState(): UiState {
  return {
    activePanel: 'chat',
    sidebarCollapsed: false,
    showTokenMetrics: false,
    historySearchKeyword: '',
  };
}

// ─── Cross-Entry Sync ────────────────────────────────────────────────

type StorageChangeHandler = (changes: Record<string, chrome.storage.StorageChange>) => void;

/**
 * Register a listener for chrome.storage.local changes.
 * The callback receives the changes object; filter by keys you care about.
 */
export function onStorageChange(handler: StorageChangeHandler): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local') return;
    handler(changes);
  };

  chrome.storage.onChanged.addListener(listener);

  // Return unsubscribe function
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

/**
 * Hydrate a Pinia store from chrome.storage.local.
 *
 * Usage:
 * ```ts
 * const settings = useSettingsStore();
 * hydrateStore('settings', (data) => settings.$patch(data));
 * ```
 */
export async function hydrateStore<T>(
  key: PersistedStoreId,
  apply: (data: T) => void,
): Promise<void> {
  const storageKey = STORE_KEYS[key];
  const stored = await chrome.storage.local.get(storageKey);
  if (stored[storageKey]?.data) {
    apply(stored[storageKey].data as T);
  }
}

/**
 * Persist a Pinia store to chrome.storage.local whenever it changes.
 *
 * Usage (inside Pinia store setup):
 * ```ts
 * const store = useSettingsStore();
 * persistStore('settings', () => store.$state);
 * ```
 */
export function persistStore<T>(
  key: PersistedStoreId,
  getData: () => T,
): () => void {
  // Save immediately on call
  const save = () => {
    const data = getData();
    chrome.storage.local.set({
      [STORE_KEYS[key]]: wrap(data),
    }).catch((err) => {
      console.error(`[Storage] Failed to persist "${key}":`, err);
    });
  };

  save();
  return save;
}
