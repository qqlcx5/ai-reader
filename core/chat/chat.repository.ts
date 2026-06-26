/**
 * Repository for the `chatHistories` table.
 *
 * The Streaming protocol uses a runtime `ChatMessage`; the
 * persisted record (`ChatHistory`) stores a flat `messages[]`
 * array so we don't need a separate table for individual turns.
 */

import { db } from '@db/dexie'
import type { ChatHistory, ChatHistoryMessage } from '@db/schema'

const now = () => Date.now()

export const chatRepository = {
  async create(
    history: Omit<ChatHistory, 'createdAt' | 'updatedAt'>
  ): Promise<ChatHistory> {
    const ts = now()
    const record: ChatHistory = {
      ...history,
      createdAt: ts,
      updatedAt: ts,
    }
    await db.chatHistories.put(record)
    return record
  },

  async get(id: string): Promise<ChatHistory | undefined> {
    return db.chatHistories.get(id)
  },

  async getForDocument(documentId: string): Promise<ChatHistory[]> {
    return db.chatHistories
      .where('documentId')
      .equals(documentId)
      .reverse()
      .sortBy('updatedAt')
  },

  async list(): Promise<ChatHistory[]> {
    return db.chatHistories.orderBy('updatedAt').reverse().toArray()
  },

  async appendMessage(
    historyId: string,
    message: ChatHistoryMessage
  ): Promise<void> {
    const history = await db.chatHistories.get(historyId)
    if (!history) throw new Error(`Chat history ${historyId} not found`)
    history.messages.push(message)
    history.updatedAt = now()
    await db.chatHistories.put(history)
  },

  async update(
    id: string,
    updates: Partial<ChatHistory>
  ): Promise<void> {
    await db.chatHistories.update(id, { ...updates, updatedAt: now() })
  },

  async delete(id: string): Promise<void> {
    await db.chatHistories.delete(id)
  },

  async deleteForDocument(documentId: string): Promise<void> {
    await db.chatHistories
      .where('documentId')
      .equals(documentId)
      .delete()
  },

  async bulkPut(histories: ChatHistory[]): Promise<void> {
    await db.chatHistories.bulkPut(histories)
  },

  async clear(): Promise<void> {
    await db.chatHistories.clear()
  },

  async count(): Promise<number> {
    return db.chatHistories.count()
  },
}
