import { getDb } from '../db';
import type { PageRecord } from '../types';

/**
 * URL normalization: strip hash fragment and common tracking parameters.
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const TRACKING = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'fbclid', 'gclid', 'ref',
    ];
    TRACKING.forEach(p => u.searchParams.delete(p));
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Generate a 16-char hex ID from a URL using Web Crypto SHA-1.
 */
export async function hashUrl(url: string): Promise<string> {
  const normalized = normalizeUrl(url);
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const pageRepo = {
  async upsert(record: PageRecord): Promise<void> {
    await getDb().pages.put(record);
  },

  async findById(id: string): Promise<PageRecord | undefined> {
    return getDb().pages.get(id);
  },

  async findByUrl(url: string): Promise<PageRecord | undefined> {
    const id = await hashUrl(url);
    return getDb().pages.get(id);
  },

  async listRecent(opts: { limit?: number } = {}): Promise<PageRecord[]> {
    const limit = opts.limit ?? 100;
    return getDb().pages.orderBy('timestamp').reverse().limit(limit).toArray();
  },

  async deleteById(id: string): Promise<void> {
    await getDb().pages.delete(id);
  },

  async search(keyword: string, limit = 50): Promise<PageRecord[]> {
    const lower = keyword.toLowerCase();
    return getDb().pages
      .filter(r =>
        r.title.toLowerCase().includes(lower) ||
        r.content.rawText.toLowerCase().includes(lower)
      )
      .limit(limit)
      .toArray();
  },
};
