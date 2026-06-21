/**
 * Message repository — stores long message bodies / model responses.
 *
 * This is the "auxiliary table" in the main/aux table split. Conversations
 * only store metadata; full content lives here and is loaded lazily when
 * entering a chat.
 *
 * Based on design-07-storage-data.md §3.3.
 */

import { getDb } from '../db';
import type {
  MessageRecord,
  ModelResponse,
  PaginationOptions,
  PageResult,
} from '../types';

export class MessageRepository {
  private get table() {
    return getDb().messages;
  }

  async create(
    record: Omit<MessageRecord, 'id' | 'createdAt'>,
    seed?: Partial<MessageRecord>,
  ): Promise<MessageRecord> {
    const item: MessageRecord = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...record,
    };
    if (seed) Object.assign(item, seed);
    await this.table.add(item);
    return item;
  }

  async getById(id: string): Promise<MessageRecord | undefined> {
    return this.table.get(id);
  }

  async update(
    id: string,
    patch: Partial<Omit<MessageRecord, 'id' | 'createdAt'>>,
  ): Promise<number> {
    return this.table.update(id, patch);
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  /** Delete all messages belonging to a conversation. */
  async deleteByConversationId(conversationId: string): Promise<number> {
    const records = await this.table
      .where('conversationId')
      .equals(conversationId)
      .toArray();
    const ids = records.map((r) => r.id);
    await this.table.bulkDelete(ids);
    return ids.length;
  }

  /** List messages for a conversation, ordered by createdAt. */
  async listByConversationId(
    conversationId: string,
    options: PaginationOptions = {},
  ): Promise<PageResult<MessageRecord>> {
    const { limit = 100, offset = 0, order = 'asc' } = options;
    const compoundIndex = this.table.where('[conversationId+createdAt]');
    const total = await this.table
      .where('conversationId')
      .equals(conversationId)
      .count();
    const items = await (
      order === 'asc'
        ? compoundIndex.equals([conversationId])
        : compoundIndex.equals([conversationId]).reverse()
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

  /** Get child messages of a parent message. */
  async getChildren(parentId: string): Promise<MessageRecord[]> {
    return this.table.where('parentId').equals(parentId).sortBy('createdAt');
  }

  /** Get the root message (no parentId) of a conversation. */
  async getRootMessage(
    conversationId: string,
  ): Promise<MessageRecord | undefined> {
    return this.table
      .where('conversationId')
      .equals(conversationId)
      .and((m) => !m.parentId)
      .first();
  }

  /**
   * Append a model response to a message's modelResponses array.
   * Used when M3 stream completes; mutates in place via Dexie update.
   */
  async addModelResponse(
    messageId: string,
    response: ModelResponse,
  ): Promise<number> {
    const message = await this.getById(messageId);
    if (!message) return 0;
    response.createdAt = response.createdAt ?? Date.now();
    return this.table.update(messageId, {
      modelResponses: [...message.modelResponses, response],
    });
  }

  /**
   * Async iterator that yields messages in batches.
   * Used by the search worker to avoid loading all messages into memory.
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
