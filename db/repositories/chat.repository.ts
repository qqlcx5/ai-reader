import { db } from '../index'
import type { ConversationEntity } from '../../types/chat'
import type { IRepository } from '../repository'

export const ChatRepository: IRepository<ConversationEntity> & {
  findByDocumentId(documentId: string): Promise<ConversationEntity[]>
  findAllSorted(): Promise<ConversationEntity[]>
  deleteByDocumentIds(documentIds: string[]): Promise<number>
} = {
  async findById(id: string): Promise<ConversationEntity | undefined> {
    return db.conversations.get(id)
  },

  async findByDocumentId(documentId: string): Promise<ConversationEntity[]> {
    return db.conversations.where('documentId').equals(documentId).toArray()
  },

  async findAll(): Promise<ConversationEntity[]> {
    return db.conversations.toArray()
  },

  async findAllSorted(): Promise<ConversationEntity[]> {
    return db.conversations.orderBy('updatedAt').reverse().toArray()
  },

  async save(conv: ConversationEntity): Promise<ConversationEntity> {
    await db.conversations.put(conv)
    return conv
  },

  async delete(id: string): Promise<void> {
    await db.conversations.delete(id)
  },

  async deleteByDocumentIds(documentIds: string[]): Promise<number> {
    if (!documentIds.length) return 0
    return db.conversations.where('documentId').anyOf(documentIds).delete()
  },

  async count(): Promise<number> {
    return db.conversations.count()
  },
}
