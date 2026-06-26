import { db } from '@/db/dexie';
import type { CapturedDocument } from '@/db/schema';
import { now } from '@/shared/utils/time';

export const documentRepository = {
  async put(doc: CapturedDocument): Promise<string> {
    doc.updatedAt = now();
    await db.documents.put(doc);
    return doc.id;
  },

  async getById(id: string): Promise<CapturedDocument | undefined> {
    return db.documents.get(id);
  },

  async getByUrl(url: string): Promise<CapturedDocument | undefined> {
    return db.documents.where('url').equals(url).first();
  },

  async getAll(): Promise<CapturedDocument[]> {
    return db.documents.orderBy('createdAt').reverse().toArray();
  },

  async getRecent(limit: number): Promise<CapturedDocument[]> {
    return db.documents.orderBy('createdAt').reverse().limit(limit).toArray();
  },

  async delete(id: string): Promise<void> {
    await db.documents.delete(id);
  },

  async count(): Promise<number> {
    return db.documents.count();
  },

  async getByDateRange(startAt: number, endAt: number): Promise<CapturedDocument[]> {
    return db.documents
      .where('createdAt')
      .between(startAt, endAt, true, true)
      .toArray();
  },
};
