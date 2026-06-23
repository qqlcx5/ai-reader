/**
 * M2 — Dexie-backed Highlights repository
 *
 * Implements the HighlightsRepository interface from lib/extraction/highlighter.
 * Integrate with the highlighter by calling setHighlightsRepository():
 *
 *   import { setHighlightsRepository } from '@/lib/extraction/highlighter';
 *   import { DexieHighlightsRepo } from '@/modules/storage/repositories/highlight.repo';
 *   import { getDb } from '@/modules/storage/db';
 *
 *   setHighlightsRepository(new DexieHighlightsRepo(getDb()));
 */
import type { HighlightsRepository } from '@/lib/extraction/highlighter';
import type { HighlightRecord } from '@/lib/extraction/types';
import type { AiReaderDB } from '../db';

export class DexieHighlightsRepo implements HighlightsRepository {
  private db: AiReaderDB;

  constructor(db: AiReaderDB) {
    this.db = db;
  }

  async add(record: HighlightRecord): Promise<void> {
    await this.db.highlights.put(record);
  }

  async getByPageId(pageId: string): Promise<HighlightRecord[]> {
    return this.db.highlights.where('pageId').equals(pageId).sortBy('createdAt');
  }

  async getByDomain(domain: string): Promise<HighlightRecord[]> {
    return this.db.highlights.where('domain').equals(domain).sortBy('createdAt');
  }

  async remove(id: string): Promise<void> {
    await this.db.highlights.delete(id);
  }

  async clear(pageId: string): Promise<void> {
    await this.db.highlights.where('pageId').equals(pageId).delete();
  }
}
