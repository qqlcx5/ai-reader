import { db } from '@/db/dexie';
import type { ChatHistory } from '@/db/schema';
import { now } from '@/shared/utils/time';

export const chatRepository = {
  async put(history: ChatHistory): Promise<string> {
    history.updatedAt = now();
    await db.chatHistories.put(history);
    return history.id;
  },

  async getById(id: string): Promise<ChatHistory | undefined> {
    return db.chatHistories.get(id);
  },

  async getByDocumentId(documentId: string): Promise<ChatHistory[]> {
    return db.chatHistories
      .where('documentId')
      .equals(documentId)
      .reverse()
      .sortBy('updatedAt');
  },

  async getAll(): Promise<ChatHistory[]> {
    return db.chatHistories.orderBy('createdAt').reverse().toArray();
  },

  async delete(id: string): Promise<void> {
    await db.chatHistories.delete(id);
  },

  async deleteByDocumentId(documentId: string): Promise<void> {
    const histories = await db.chatHistories
      .where('documentId')
      .equals(documentId)
      .toArray();
    await db.chatHistories.bulkDelete(histories.map((h) => h.id));
  },

  async count(): Promise<number> {
    return db.chatHistories.count();
  },
};
