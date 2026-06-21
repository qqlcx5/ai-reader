/**
 * M8 — Hash-based deduplication.
 *
 * Computes a stable hash from (feedId + title + link) so that the same
 * article fetched multiple times is only stored once. The hash uses a
 * deterministic string-based approach (no crypto dependency needed).
 */
import type { DedupInput } from './types';

/**
 * Compute a stable dedup hash for an RSS item.
 *
 * Uses FNV-1a-inspired 32-bit hash for fast, collision-resistant
 * fingerprinting. Hex-encoded to 8 characters for compact storage.
 */
export function computeItemHash(input: DedupInput): string {
  const raw = `${input.feedId}:${input.title}:${input.link}`;
  return fnv1a32(raw).toString(16).padStart(8, '0');
}

/**
 * FNV-1a 32-bit hash.
 */
function fnv1a32(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // FNV prime: 0x01000193 (32-bit)
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0; // ensure unsigned
}

/**
 * Filter out items whose hash already exists in the store.
 *
 * `existingHashes` is a Set of hashes already present in `rssItems`.
 * Returns only the items that are genuinely new.
 */
export function filterNewItems<T extends DedupInput>(
  candidates: T[],
  existingHashes: Set<string>,
): T[] {
  return candidates.filter((item) => {
    const hash = computeItemHash(item);
    return !existingHashes.has(hash);
  });
}
