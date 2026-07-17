import dayjs from 'dayjs'
import { db } from '../index'
import type { CollectionEntity, CollectionItemEntity } from '../../types/collection'

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export const CollectionRepository = {
  async findById(id: string): Promise<CollectionEntity | undefined> {
    return db.collections.get(id)
  },

  async findAll(): Promise<CollectionEntity[]> {
    return db.collections.orderBy('updatedAt').reverse().toArray()
  },

  async save(collection: CollectionEntity): Promise<CollectionEntity> {
    await db.collections.put(collection)
    return collection
  },

  async count(): Promise<number> {
    return db.collections.count()
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.collections, db.collectionItems, async () => {
      await db.collectionItems.where('collectionId').equals(id).delete()
      await db.collections.delete(id)
    })
  },

  /** Add a document to a collection; no-op if already a member. New items append to the end. */
  async addDocument(collectionId: string, documentId: string): Promise<void> {
    await db.transaction('rw', db.collectionItems, async () => {
      const existing = await db.collectionItems
        .where('[collectionId+documentId]')
        .equals([collectionId, documentId])
        .first()
      if (existing) return
      const count = await db.collectionItems.where('collectionId').equals(collectionId).count()
      const item: CollectionItemEntity = {
        id: uuid(),
        collectionId,
        documentId,
        order: count,
        addedAt: dayjs().toISOString(),
      }
      await db.collectionItems.put(item)
    })
  },

  async removeDocument(collectionId: string, documentId: string): Promise<void> {
    await db.collectionItems
      .where('[collectionId+documentId]')
      .equals([collectionId, documentId])
      .delete()
  },

  /** Ordered document ids belonging to a collection. */
  async getDocumentIds(collectionId: string): Promise<string[]> {
    const items = await db.collectionItems.where('collectionId').equals(collectionId).toArray()
    return items.sort((a, b) => a.order - b.order).map((i) => i.documentId)
  },

  async countItems(collectionId: string): Promise<number> {
    return db.collectionItems.where('collectionId').equals(collectionId).count()
  },

  async isMember(collectionId: string, documentId: string): Promise<boolean> {
    const n = await db.collectionItems
      .where('[collectionId+documentId]')
      .equals([collectionId, documentId])
      .count()
    return n > 0
  },

  /** Cascade-clean all collectionItems references for a set of documents. */
  async removeDocumentsFromAllCollections(documentIds: string[]): Promise<number> {
    if (!documentIds.length) return 0
    return db.collectionItems.where('documentId').anyOf(documentIds).delete()
  },
}
