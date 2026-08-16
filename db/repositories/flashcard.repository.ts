import { db } from '../index'
import type { FlashcardEntity } from '../../types/flashcard'

export const FlashcardRepository = {
  async findById(id: string): Promise<FlashcardEntity | undefined> {
    return db.flashcards.get(id)
  },

  async findByDocument(documentId: string): Promise<FlashcardEntity[]> {
    return db.flashcards.where('documentId').equals(documentId).toArray()
  },

  async findAll(): Promise<FlashcardEntity[]> {
    return db.flashcards.orderBy('createdAt').toArray()
  },

  /** Cards due at (or before) `now`, oldest due first. */
  async findDue(nowISO: string, limit?: number): Promise<FlashcardEntity[]> {
    let coll = db.flashcards.where('sm2.dueAt').belowOrEqual(nowISO)
    if (limit != null) coll = coll.limit(limit)
    return coll.toArray()
  },

  async save(card: FlashcardEntity): Promise<FlashcardEntity> {
    await db.flashcards.put(card)
    return card
  },

  async saveMany(cards: FlashcardEntity[]): Promise<void> {
    await db.flashcards.bulkPut(cards)
  },

  async delete(id: string): Promise<void> {
    await db.flashcards.delete(id)
  },

  async deleteByDocument(documentId: string): Promise<void> {
    await db.flashcards.where('documentId').equals(documentId).delete()
  },

  async count(): Promise<number> {
    return db.flashcards.count()
  },

  async countDue(nowISO: string): Promise<number> {
    return db.flashcards.where('sm2.dueAt').belowOrEqual(nowISO).count()
  },
}
