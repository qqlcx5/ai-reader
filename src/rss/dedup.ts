/**
 * M8 RSS Pipeline — Deduplication
 *
 * Computes stable hashes for RSS items and filters out duplicates
 * against the existing item database.
 *
 * Based on design-08-rss-pipeline.md §5.3.
 */

import type { RssItem } from './types';

// ─── Hash Computation ────────────────────────────────────────────────

/**
 * Compute a stable hash for deduplication.
 * Concatenates feedId + title + link and uses a simple DJB2 hash
 * (avoids external deps — consistent enough for RSS dedup).
 */
export function computeItemHash(feedId: string, title: string, link: string): string {
  const input = `${feedId}:${title}:${link}`;
  return djb2Hash(input);
}

/**
 * DJB2 hash algorithm — fast, deterministic, and good enough
 * for RSS deduplication.
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
    hash = hash & hash; // Convert to 32-bit integer
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ─── Deduplication ───────────────────────────────────────────────────

/**
 * Filter new items to include only those whose hashes don't already
 * exist in the stored items database.
 *
 * Uses chrome.storage or in-memory Set for the check.
 */
export async function deduplicateItems(newItems: RssItem[]): Promise<RssItem[]> {
  // Collect all item hashes from new batch
  const newHashes = newItems.map((i) => i.hash);
  const uniqueNewHashes = [...new Set(newHashes)];

  // Get stored hashes from chrome.storage
  const storedHashes = await getStoredHashes();

  // Filter: keep only items whose hash is not in storage
  return newItems.filter((item, index) => {
    // Also dedup within the batch itself (first occurrence wins)
    if (newHashes.indexOf(item.hash) !== index) return false;
    return !storedHashes.has(item.hash);
  });
}

// ─── Storage Helpers ─────────────────────────────────────────────────

const HASH_STORE_KEY = 'rss-item-hashes';

/**
 * Get all known item hashes from storage.
 * Returns a Set for O(1) lookup.
 */
async function getStoredHashes(): Promise<Set<string>> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const stored = (await chrome.storage.local.get(HASH_STORE_KEY))[HASH_STORE_KEY];
      if (Array.isArray(stored)) {
        return new Set(stored as string[]);
      }
    } else {
      const raw = localStorage.getItem(HASH_STORE_KEY);
      if (raw) return new Set(JSON.parse(raw));
    }
  } catch {
    // Ignore
  }
  return new Set();
}

/**
 * Store new item hashes to prevent future duplicates.
 */
export async function storeItemHashes(hashes: string[]): Promise<void> {
  try {
    const existing = await getStoredHashes();
    for (const hash of hashes) existing.add(hash);

    const hashArray = [...existing];
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [HASH_STORE_KEY]: hashArray });
    } else {
      localStorage.setItem(HASH_STORE_KEY, JSON.stringify(hashArray));
    }
  } catch {
    // Ignore
  }
}

/**
 * Check if an item hash has already been seen.
 */
export async function isDuplicateHash(hash: string): Promise<boolean> {
  const hashes = await getStoredHashes();
  return hashes.has(hash);
}
