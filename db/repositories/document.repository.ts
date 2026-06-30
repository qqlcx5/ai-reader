import { db } from '../index'
import type { DocumentEntity } from '../../types/document'
import type { IRepository } from '../repository'

export const DocumentRepository: IRepository<DocumentEntity> & {
  findByUrl(url: string): Promise<DocumentEntity | undefined>
  findByDateRange(start: string, end: string): Promise<DocumentEntity[]>
  findPaginated(offset: number, limit: number): Promise<DocumentEntity[]>
  touchLastOpened(id: string, iso: string): Promise<void>
} = {
  async findById(id: string): Promise<DocumentEntity | undefined> {
    return db.documents.get(id)
  },

  async findByUrl(url: string): Promise<DocumentEntity | undefined> {
    return db.documents.where('url').equals(url).first()
  },

  async findByDateRange(start: string, end: string): Promise<DocumentEntity[]> {
    return db.documents
      .where('capturedAt')
      .between(start, end, true, true)
      .toArray()
  },

  async findPaginated(offset: number, limit: number): Promise<DocumentEntity[]> {
    return db.documents
      .orderBy('capturedAt')
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray()
  },

  async findAll(): Promise<DocumentEntity[]> {
    return db.documents.orderBy('capturedAt').reverse().toArray()
  },

  async save(doc: DocumentEntity): Promise<DocumentEntity> {
    // Use a readwrite transaction to make the find-by-URL check and
    // subsequent put atomic, preventing concurrent captures of the
    // same URL from creating duplicate documents.
    return db.transaction('rw', db.documents, async () => {
      // 1. Check for existing document by URL
      const existing = await db.documents.where('url').equals(doc.url).first()
      if (existing) {
        const merged: DocumentEntity = {
          ...doc,
          id: existing.id,
          capturedAt: existing.capturedAt,
          updatedAt: doc.updatedAt || new Date().toISOString(),
        }
        await db.documents.put(merged)
        return merged
      }

      // 2. Check canonicalUrl (if provided and different from url)
      if (doc.canonicalUrl && doc.canonicalUrl !== doc.url) {
        const canonExisting = await db.documents
          .where('canonicalUrl')
          .equals(doc.canonicalUrl)
          .first()
        if (canonExisting) {
          const merged: DocumentEntity = {
            ...doc,
            id: canonExisting.id,
            capturedAt: canonExisting.capturedAt,
            updatedAt: doc.updatedAt || new Date().toISOString(),
          }
          await db.documents.put(merged)
          return merged
        }
      }

      // 3. No existing document found — insert as new
      await db.documents.put(doc)
      return doc
    })
  },

  async delete(id: string): Promise<void> {
    await db.documents.delete(id)
  },

  /** Partial update of just lastOpenedAt (avoids the URL-dedup path in `save`). */
  async touchLastOpened(id: string, iso: string): Promise<void> {
    await db.documents.update(id, { lastOpenedAt: iso })
  },

  async count(): Promise<number> {
    return db.documents.count()
  },
}
