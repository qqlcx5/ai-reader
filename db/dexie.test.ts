/**
 * Schema and Dexie smoke tests.
 *
 * Uses `fake-indexeddb` to back Dexie in jsdom so the schema
 * actually compiles to a real database and indexes can be
 * exercised.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db, AIReaderDatabase } from './dexie'
import { CURRENT_SCHEMA_VERSION } from './schema'
import type { CapturedDocument, ChatHistory, SettingsEntry } from '../schema'

function makeDoc(overrides: Partial<CapturedDocument> = {}): CapturedDocument {
  return {
    id: overrides.id ?? `doc-${Math.random().toString(36).slice(2, 9)}`,
    url: overrides.url ?? 'https://example.com/post',
    title: overrides.title ?? 'Example post',
    markdownContent: overrides.markdownContent ?? '# Hello',
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('schema constants', () => {
  it('CURRENT_SCHEMA_VERSION is a positive integer', () => {
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(1)
  })
})

describe('Dexie schema', () => {
  it('exposes the three core tables', () => {
    expect(db.documents).toBeDefined()
    expect(db.chatHistories).toBeDefined()
    expect(db.settings).toBeDefined()
  })

  it('creates a new database instance on demand', () => {
    const custom = new AIReaderDatabase('TestOtherDB')
    expect(custom.name).toBe('TestOtherDB')
    custom.close()
  })
})

describe('documents table', () => {
  it('puts and gets a document', async () => {
    const doc = makeDoc({ id: 'a' })
    await db.documents.put(doc)
    const fetched = await db.documents.get('a')
    expect(fetched).toMatchObject({ id: 'a', url: doc.url, title: doc.title })
  })

  it('lists documents sorted by createdAt desc', async () => {
    await db.documents.bulkPut([
      makeDoc({ id: 'a', createdAt: 1000 }),
      makeDoc({ id: 'b', createdAt: 3000 }),
      makeDoc({ id: 'c', createdAt: 2000 }),
    ])
    const list = await db.documents.orderBy('createdAt').reverse().toArray()
    expect(list.map((d) => d.id)).toEqual(['b', 'c', 'a'])
  })

  it('deletes a document', async () => {
    await db.documents.put(makeDoc({ id: 'a' }))
    await db.documents.delete('a')
    expect(await db.documents.get('a')).toBeUndefined()
  })
})

describe('chatHistories table', () => {
  it('indexes by documentId', async () => {
    const history: ChatHistory = {
      id: 'h1',
      documentId: 'doc-1',
      modelId: 'm1',
      model: 'gpt-4o',
      messages: [],
      createdAt: 0,
      updatedAt: 0,
    }
    await db.chatHistories.put(history)
    const byDoc = await db.chatHistories.where('documentId').equals('doc-1').toArray()
    expect(byDoc).toHaveLength(1)
    expect(byDoc[0].id).toBe('h1')
  })
})

describe('settings table', () => {
  it('stores a generic key/value entry', async () => {
    const entry: SettingsEntry = { key: 'theme', value: 'dark', updatedAt: Date.now() }
    await db.settings.put(entry)
    const fetched = await db.settings.get('theme')
    expect(fetched?.value).toBe('dark')
  })
})
