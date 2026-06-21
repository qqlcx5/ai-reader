import { getDb } from '../db';
import {
  type MessageRecord,
  type ModelResponse,
  type PaginationOptions,
  type PageResult,
} from '../types';

/**
 * Message repository — stores the long message bodies and model responses.
 *
 * This is the "auxiliary table" in the main/aux table split. Conversations only
 * store metadata; full content lives here and is loaded lazily when entering a chat.
 */
export class MessageRepository {
  private table = getDb().messages;

  async create(
    record: Omit<MessageRecord, 'id' | 'createdAt'>,
    seed?: Partial<MessageRecord>,
  ): Promise<MessageRecord> {
    const now = Date.now();
    const item = {
      ...JSON.parse(JSON.stringify(record)),
      id: crypto.randomUUID(),
      createdAt: now,
    } as MessageRecord;
    if (seed) Object.assign(item, JSON.parse(JSON.stringify(seed)));
    await this.table.add(item);
    return item;
  }

  async getById(id: string): Promise<MessageRecord | undefined> {
    return this.table.get(id);
  }

  async update(id: string, patch: Partial<Omit<MessageRecord, 'id' | 'createdAt'>>): Promise<number> {
    return this.table.update(id, JSON.parse(JSON.stringify(patch)));
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  async deleteByConversationId(conversationId: string): Promise<number> {
    const records = await this.table.where('conversationId').equals(conversationId).toArray();
    const ids = records.map((r) => r.id);
    await this.table.bulkDelete(ids);
    return ids.length;
  }

  async listByConversationId(
    conversationId: string,
    options: PaginationOptions = {},
  ): Promise<PageResult<MessageRecord>> {
    const { limit = 100, offset = 0, order = 'asc' } = options;
    const collection = this.table.where('[conversationId+createdAt]');
    const total = await this.table.where('conversationId').equals(conversationId).count();
    const items = await (order === 'asc'
      ? collection.equals([conversationId]).offset(offset).limit(limit).toArray()
      : collection.equals([conversationId]).reverse().offset(offset).limit(limit).toArray());
    return {
      items,
      total,
      hasMore: offset + items.length < total,
      nextOffset: offset + items.length,
    };
  }

  async getChildren(parentId: string): Promise<MessageRecord[]> {
    return this.table.where('parentId').equals(parentId).sortBy('createdAt');
  }

  async getRootMessage(conversationId: string): Promise<MessageRecord | undefined> {
    return this.table.where('conversationId').equals(conversationId).and((m) => !m.parentId).first();
  }

  async addModelResponse(messageId: string, response: ModelResponse): Promise<number> {
    const message = await this.getById(messageId);
    if (!message) return 0;
    const safeResponse = JSON.parse(JSON.stringify(response));
    safeResponse.createdAt = safeResponse.createdAt || Date.now();
    return this.table.update(messageId, {
      modelResponses: [...message.modelResponses, safeResponse],
    });
  }

  /**
   * Iterate over messages in batches. This is used by the search worker feed
   * to avoid loading all messages into memory at once.
   */
  async *batchIterator(
    conversationId?: string,
    batchSize = 500,
  ): AsyncGenerator<MessageRecord[], void, unknown> {
    let offset = 0;
    let hasMore = true;
    const base = conversationId
      ? this.table.where('[conversationId+createdAt]').equals([conversationId])
      : this.table.orderBy('createdAt');

    while (hasMore) {
      const batch = await base.offset(offset).limit(batchSize).toArray();
      yield batch;
      hasMore = batch.length === batchSize;
      offset += batch.length;
    }
  }

  async count(): Promise<number> {
    return this.table.count();
  }
}

export const messageRepo = new MessageRepository();
