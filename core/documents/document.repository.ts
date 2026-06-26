/**
 * Repository for the `documents` table.
 *
 * A thin wrapper over the Dexie table that:
 *   - provides typed CRUD
 *   - normalises `createdAt` / `updatedAt`
 *   - exposes query helpers that the Perception / Search / Timeline
 *     modules actually need (by URL, by date range, full dump).
 *
 * Compression of `rawHtml` (lz-string) is layered on top by
 * `Persistence` and lives outside this module to keep concerns
 * separated.
 */

import { db } from '@db/dexie'
import type { CapturedDocument, DocumentMetadata } from '@db/schema'

const now = () => Date.now()

function toMetadata(doc: CapturedDocument): DocumentMetadata {
  return {
    id: doc.id,
    url: doc.url,
    title: doc.title,
    description: doc.description,
    author: doc.author,
    publishedAt: doc.publishedAt,
    siteName: doc.siteName,
    favicon: doc.favicon,
    image: doc.image,
    wordCount: doc.wordCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export const documentRepository = {
  async put(doc: CapturedDocument): Promise<string> {
    const ts = now()
    const record: CapturedDocument = {
      ...doc,
      createdAt: doc.createdAt || ts,
      updatedAt: ts,
    }
    await db.documents.put(record)
    return record.id
  },

  async get(id: string): Promise<CapturedDocument | undefined> {
    return db.documents.get(id)
  },

  async getByUrl(url: string): Promise<CapturedDocument | undefined> {
    return db.documents.where('url').equals(url).first()
  },

  async list(limit = 200, offset = 0): Promise<DocumentMetadata[]> {
    const all = await db.documents
      .orderBy('createdAt')
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray()
    return all.map(toMetadata)
  },

  async listAll(): Promise<CapturedDocument[]> {
    return db.documents.orderBy('createdAt').reverse().toArray()
  },

  async listSince(sinceMs: number): Promise<CapturedDocument[]> {
    return db.documents
      .where('createdAt')
      .aboveOrEqual(sinceMs)
      .reverse()
      .toArray()
  },

  async update(
    id: string,
    updates: Partial<CapturedDocument>
  ): Promise<void> {
    await db.documents.update(id, { ...updates, updatedAt: now() })
  },

  async delete(id: string): Promise<void> {
    await db.documents.delete(id)
  },

  async bulkPut(docs: CapturedDocument[]): Promise<void> {
    const ts = now()
    await db.documents.bulkPut(
      docs.map((d) => ({
        ...d,
        createdAt: d.createdAt || ts,
        updatedAt: ts,
      }))
    )
  },

  async clear(): Promise<void> {
    await db.documents.clear()
  },

  async count(): Promise<number> {
    return db.documents.count()
  },
}
