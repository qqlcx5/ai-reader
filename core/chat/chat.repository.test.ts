/**
 * chat.repository unit tests.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../db/dexie'
import { chatRepository } from './chat.repository'
import type { ChatHistory } from '@db/schema'

const baseHistory: Omit<ChatHistory, 'createdAt' | 'updatedAt'> = {
  id: 'h1',
  documentId: 'doc-1',
  modelId: 'm1',
  model: 'gpt-4o',
  messages: [],
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('chatRepository', () => {
  it('create() returns a record with timestamps', async () => {
    const created = await chatRepository.create(baseHistory)
    expect(created.createdAt).toBeGreaterThan(0)
    expect(created.updatedAt).toBeGreaterThan(0)
  })

  it('appendMessage() pushes a message and bumps updatedAt', async () => {
    const created = await chatRepository.create(baseHistory)
    await chatRepository.appendMessage(created.id, {
      id: 'msg-1',
      role: 'user',
      content: 'hi',
      createdAt: Date.now(),
    })
    const fetched = await chatRepository.get(created.id)
    expect(fetched?.messages).toHaveLength(1)
    expect(fetched?.messages[0].role).toBe('user')
  })

  it('getForDocument() filters by documentId', async () => {
    await chatRepository.create({ ...baseHistory, id: 'h1', documentId: 'doc-1' })
    await chatRepository.create({ ...baseHistory, id: 'h2', documentId: 'doc-2' })
    const list = await chatRepository.getForDocument('doc-1')
    expect(list.map((h) => h.id)).toEqual(['h1'])
  })

  it('deleteForDocument() removes only matching histories', async () => {
    await chatRepository.create({ ...baseHistory, id: 'h1', documentId: 'doc-1' })
    await chatRepository.create({ ...baseHistory, id: 'h2', documentId: 'doc-2' })
    await chatRepository.deleteForDocument('doc-1')
    expect(await chatRepository.get('h1')).toBeUndefined()
    expect(await chatRepository.get('h2')).toBeTruthy()
  })

  it('appendMessage() throws when the history is missing', async () => {
    await expect(
      chatRepository.appendMessage('missing', {
        id: 'x',
        role: 'user',
        content: 'hi',
        createdAt: 0,
      })
    ).rejects.toThrow(/not found/i)
  })
})
