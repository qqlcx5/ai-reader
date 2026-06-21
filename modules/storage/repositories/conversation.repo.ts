import { getDb } from '../db';
import {
  type ConversationRecord,
  type ConversationMode,
  type PaginationOptions,
  type PageResult,
} from '../types';

/**
 * Conversation metadata repository.
 *
 * The main table stores ONLY metadata (title, preview, counts, etc.).
 * Long message bodies are stored in the messages repository.
 */
export class ConversationRepository {
  private table = getDb().conversations;

  async create(
    record: Omit<ConversationRecord, 'id' | 'createdAt' | 'updatedAt' | 'messageCount' | 'preview'>,
    seed?: Partial<ConversationRecord>,
  ): Promise<ConversationRecord> {
    const now = Date.now();
    const item = {
      ...JSON.parse(JSON.stringify(record)),
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      preview: '',
    } as ConversationRecord;
    if (seed) Object.assign(item, JSON.parse(JSON.stringify(seed)));
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
    return this.table.update(id, { ...JSON.parse(JSON.stringify(patch)), updatedAt: Date.now() });
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  async listRecent(options: PaginationOptions = {}): Promise<PageResult<ConversationRecord>> {
    const { limit = 50, offset = 0, order = 'desc' } = options;
    const collection = this.table.orderBy('updatedAt');
    const total = await this.table.count();
    const items = await (order === 'asc' ? collection : collection.reverse()).offset(offset).limit(limit).toArray();
    return {
      items,
      total,
      hasMore: offset + items.length < total,
      nextOffset: offset + items.length,
    };
  }

  async listByMode(mode: ConversationMode, options: PaginationOptions = {}): Promise<PageResult<ConversationRecord>> {
    const { limit = 50, offset = 0, order = 'desc' } = options;
    let collection = this.table.where('mode').equals(mode);
    const total = await collection.count();
    const items = await collection
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray();
    const sorted = order === 'asc' ? items.sort((a, b) => a.updatedAt - b.updatedAt) : items.sort((a, b) => b.updatedAt - a.updatedAt);
    return {
      items: sorted,
      total,
      hasMore: offset + items.length < total,
      nextOffset: offset + items.length,
    };
  }

  async searchByTitle(query: string, options: PaginationOptions = {}): Promise<PageResult<ConversationRecord>> {
    const { limit = 50, offset = 0 } = options;
    const lower = query.toLowerCase();
    // Dexie does not support full-text; we use a prefix-ish filter on title + preview.
    // For large data the UI should pair this with the Worker deep search.
    const all = await this.table.orderBy('updatedAt').reverse().toArray();
    const filtered = all.filter(
      (c) => c.title.toLowerCase().includes(lower) || c.preview.toLowerCase().includes(lower),
    );
    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);
    return {
      items,
      total,
      hasMore: offset + items.length < total,
      nextOffset: offset + items.length,
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
    const items = records.map((r, i) => ({
      ...r,
      id: crypto.randomUUID(),
      createdAt: now + i,
      updatedAt: now + i,
      messageCount: 0,
      preview: '',
    } as ConversationRecord));
    await this.table.bulkAdd(items);
    return items;
  }
}

export const conversationRepo = new ConversationRepository();
