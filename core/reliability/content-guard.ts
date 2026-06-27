// ============================================================
// Content Guard — Deduplication & Injection Guard
// Prevents re-extracting pages already in the library.
// ============================================================

import { db } from '../../db/schema'

/**
 * Check whether a URL should be extracted.
 * Returns false if the URL already exists in IndexedDB (by exact match).
 * Optionally performs content hash comparison to detect article updates.
 */
export async function shouldExtract(url: string): Promise<boolean> {
  if (!url || url.startsWith('chrome://') || url.startsWith('about:')) {
    return false
  }

  try {
    const existing = await db.articles.where('url').equals(url).count()
    return existing === 0
  } catch (err) {
    // If IndexedDB is unavailable, allow extraction (degrade gracefully)
    console.warn('[ContentGuard] IndexedDB lookup failed, allowing extraction:', err)
    return true
  }
}

/**
 * Check by URL + optional title hash to detect content changes.
 * Returns 'exists' | 'changed' | 'new'.
 */
export type DedupResult = 'exists' | 'changed' | 'new'

export async function checkArticleStatus(url: string, titleHash?: number): Promise<DedupResult> {
  if (!url || url.startsWith('chrome://') || url.startsWith('about:')) {
    return 'exists'
  }

  try {
    const articles = await db.articles.where('url').equals(url).limit(1).toArray()
    if (articles.length === 0) return 'new'

    if (titleHash) {
      const existingHash = simpleHash(articles[0].title)
      return existingHash === titleHash ? 'exists' : 'changed'
    }

    return 'exists'
  } catch {
    return 'new'
  }
}

/**
 * Simple string hash (Fowler–Noll–Vo 1a 32-bit).
 */
function simpleHash(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
