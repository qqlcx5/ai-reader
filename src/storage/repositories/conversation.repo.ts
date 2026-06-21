/**
 * Conversation metadata repository.
 *
 * The main table stores ONLY metadata (title, preview, counts, etc.).
 * Long message bodies are stored in the messages table and loaded lazily
 * when entering a chat.
 *
 * Based on design-07-storage-data.md §3.2.
 */

import { getDb } from '../db';
import type {
  ConversationRecord,
  ConversationMode,
  PaginationOptions,
  PageResult,
} from '../types';

export class ConversationRepository {
  private get table() {
    return getDb().conversations;
  }

  async create(
    record: Omit<ConversationRecord, 'id' | 'createdAt' | 'updatedAt' | 'messageCount' | 'preview'>,
    seed?: Partial<ConversationRecord>,
  ): Promise<ConversationRecord> {
    const now = Date.now();
    const item: ConversationRecord = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      preview: '',
      ...record,
    };
    if (seed) Object.assign(item, seed);
    await this.table.add(item);
    return item;
  }

  async getById(id: string): Promise<ConversationRecord | undefined> {
    return this.table.get(id);
  }

  async update(
    id: string,
    patch: Partial<Omit<ConversationRecord, 'id' | 'createdAt'>>,
  ): Promise<number> {
    return this.table.update(id, { ...patch, updatedAt: Date.now() });
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  /** List recently updated conversations (paginated). */
  async listRecent(options: PaginationOptions = {}): Promise<PageResult<ConversationRecord>> {
    const { limit = 50, offset = 0, order = 'desc' } = options;
    const collection = this.table.orderBy('updatedAt');
    const total = await this.table.count();
    const items = await (
      order === 'asc' ? collection : collection.reverse()
    )
      .offset(offset)
      .limit(limit)
      .toArray();
    return {
      items,
      total,
      hasMore: offset + items.length < total,
      nextOffset: offset + items.length,
    };
  }

  /** List conversations filtered by mode. */
  async listByMode(
    mode: ConversationMode,
    options: PaginationOptions = {},
  ): Promise<PageResult<ConversationRecord>> {
    const { limit = 50, offset = 0, order = 'desc' } = options;
    const collection = this.table.where('mode').equals(mode);
    const total = await collection.count();
    const all = await collection.reverse().toArray();
    const sorted =
      order === 'asc'
        ? all.sort((a, b) => a.updatedAt - b.updatedAt)
        : all.sort((a, b) => b.updatedAt - a.updatedAt);
    return {
      items: sorted.slice(offset, offset + limit),
      total,
      hasMore: offset + limit < total,
      nextOffset: offset + limit,
    };
  }

  /** Search conversations by title or preview substring. */
  async searchByTitle(
    query: string,
    options: PaginationOptions = {},
  ): Promise<PageResult<ConversationRecord>> {
    const { limit = 50, offset = 0 } = options;
    const lower = query.toLowerCase();
    const all = await this.table.orderBy('updatedAt').reverse().toArray();
    const filtered = all.filter(
      (c) =>
        c.title.toLowerCase().includes(lower) ||
        c.preview.toLowerCase().includes(lower),
    );
    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
      nextOffset: offset + limit,
    };
  }

  async refreshUpdatedAt(id: string): Promise<number> {
    return this.table.update(id, { updatedAt: Date.now() });
  }

  async count(): Promise<number> {
    return this.table.count();
  }

  async bulkCreate(
    records: Omit<ConversationRecord, 'id' | 'createdAt' | 'updatedAt' | 'messageCount' | 'preview'>[],
  ): Promise<ConversationRecord[]> {
    const now = Date.now();
    const items: ConversationRecord[] = records.map((r, i) => ({
      id: crypto.randomUUID(),
      createdAt: now + i,
      updatedAt: now + i,
      messageCount: 0,
      preview: '',
      ...r,
    }));
    await this.table.bulkAdd(items);
    return items;
  }
}

export const conversationRepo = new ConversationRepository();
