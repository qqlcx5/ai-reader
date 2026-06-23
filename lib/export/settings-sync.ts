/**
 * M7 — Browser-to-browser settings sync via chrome.storage.sync.
 *
 * chrome.storage.sync has a hard 8 KB-per-key limit. We work around this by:
 *  1. JSON-serialising the settings (API keys stripped).
 *  2. Compressing with lz-string `compressToUTF16` — typically 3–5× reduction.
 *  3. Splitting the compressed string into CHUNK_SIZE chunks.
 *  4. Storing each chunk as `settings_chunk_{n}` plus a count key.
 *
 * Synced content: Provider configs (no API keys), prompt templates, UI settings.
 * NOT synced: API keys (stay in chrome.storage.local via key-store).
 */
import LZString from 'lz-string';
import type { Settings } from '@/modules/storage/types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max characters per chrome.storage.sync value (byte budget ≈ 8 192). */
export const CHUNK_SIZE = 8_000;

const CHUNK_KEY_PREFIX = 'settings_chunk_';
const CHUNK_COUNT_KEY = 'settings_chunks_count';
const SCHEMA_VERSION_KEY = 'settings_schema_v';
const SCHEMA_VERSION = 1;

// ─── Types ────────────────────────────────────────────────────────────────────

/** The subset of Settings that is safe to sync across browsers (no secrets). */
export type SyncableSettings = Omit<Settings, 'exportConfig'> & {
  exportConfig?: Partial<Pick<Settings['exportConfig'], 'format' | 'autoBackupEnabled' | 'autoBackupIntervalDays'>>;
};

// ─── Save ─────────────────────────────────────────────────────────────────────

/**
 * Compress and shard `settings` into chrome.storage.sync.
 * API keys are stripped before serialisation.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  const safe = stripSecrets(settings);
  const json = JSON.stringify(safe);
  const compressed = LZString.compressToUTF16(json);

  const chunks: string[] = [];
  for (let i = 0; i < compressed.length; i += CHUNK_SIZE) {
    chunks.push(compressed.slice(i, i + CHUNK_SIZE));
  }

  // Build the payload atomically
  const payload: Record<string, string | number> = {
    [CHUNK_COUNT_KEY]: chunks.length,
    [SCHEMA_VERSION_KEY]: SCHEMA_VERSION,
  };
  chunks.forEach((chunk, i) => {
    payload[`${CHUNK_KEY_PREFIX}${i}`] = chunk;
  });

  await chrome.storage.sync.set(payload);
}

// ─── Load ─────────────────────────────────────────────────────────────────────

/**
 * Read, reassemble, and decompress the settings from chrome.storage.sync.
 * Returns `null` when no data is stored yet.
 */
export async function loadSettings(): Promise<SyncableSettings | null> {
  const meta = await chrome.storage.sync.get([CHUNK_COUNT_KEY, SCHEMA_VERSION_KEY]);
  const count = meta[CHUNK_COUNT_KEY] as number | undefined;
  if (!count || count <= 0) return null;

  const keys = Array.from({ length: count }, (_, i) => `${CHUNK_KEY_PREFIX}${i}`);
  const chunkData = await chrome.storage.sync.get(keys);

  const compressed = keys.map((k) => (chunkData[k] as string) ?? '').join('');
  if (!compressed) return null;

  const json = LZString.decompressFromUTF16(compressed);
  if (!json) return null;

  try {
    return JSON.parse(json) as SyncableSettings;
  } catch {
    return null;
  }
}

// ─── Clear ────────────────────────────────────────────────────────────────────

/** Remove all synced settings chunks from chrome.storage.sync. */
export async function clearSyncedSettings(): Promise<void> {
  const meta = await chrome.storage.sync.get(CHUNK_COUNT_KEY);
  const count = (meta[CHUNK_COUNT_KEY] as number | undefined) ?? 0;
  const keys = [
    CHUNK_COUNT_KEY,
    SCHEMA_VERSION_KEY,
    ...Array.from({ length: count }, (_, i) => `${CHUNK_KEY_PREFIX}${i}`),
  ];
  await chrome.storage.sync.remove(keys);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripSecrets(settings: Settings): SyncableSettings {
  return {
    ...settings,
    // Remove API keys from all providers
    providers: settings.providers.map((p) => ({ ...p, apiKey: '' })),
    // Keep only non-sensitive export config fields
    exportConfig: {
      format: settings.exportConfig.format,
      autoBackupEnabled: settings.exportConfig.autoBackupEnabled,
      autoBackupIntervalDays: settings.exportConfig.autoBackupIntervalDays,
    },
  };
}
