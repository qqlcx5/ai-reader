/**
 * document.repository unit tests.
 *
 * Each test starts with a fresh database so we can assert exact
 * contents and ordering.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../db/dexie'
import { documentRepository } from './document.repository'
import type { CapturedDocument } from '@db/schema'

function makeDoc(overrides: Partial<CapturedDocument> = {}): CapturedDocument {
  return {
    id: overrides.id ?? `doc-${Math.random().toString(36).slice(2, 9)}`,
    url: overrides.url ?? `https://example.com/${Math.random().toString(36).slice(2, 8)}`,
    title: overrides.title ?? 'Example post',
    markdownContent: overrides.markdownContent ?? '# Hello',
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt,
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('documentRepository', () => {
  it('put() stores a document and returns its id', async () => {
    const id = await documentRepository.put(makeDoc({ id: 'a' }))
    expect(id).toBe('a')
    const fetched = await documentRepository.get('a')
    expect(fetched?.title).toBe('Example post')
  })

  it('put() normalises createdAt and updatedAt when missing', async () => {
    await documentRepository.put({ id: 'a', url: 'u', title: 't', markdownContent: '' } as CapturedDocument)
    const fetched = await documentRepository.get('a')
    expect(fetched?.createdAt).toBeGreaterThan(0)
    expect(fetched?.updatedAt).toBeGreaterThan(0)
  })

  it('getByUrl finds the first matching document', async () => {
    await documentRepository.put(makeDoc({ id: 'a', url: 'https://e.com' }))
    const found = await documentRepository.getByUrl('https://e.com')
    expect(found?.id).toBe('a')
  })

  it('list() returns metadata (no markdownContent) sorted desc', async () => {
    await documentRepository.bulkPut([
      makeDoc({ id: 'a', createdAt: 1000 }),
      makeDoc({ id: 'b', createdAt: 3000 }),
    ])
    const list = await documentRepository.list()
    expect(list.map((d) => d.id)).toEqual(['b', 'a'])
    // metadata doesn't carry markdownContent
    expect((list[0] as unknown as { markdownContent?: string }).markdownContent).toBeUndefined()
  })

  it('update() bumps updatedAt', async () => {
    await documentRepository.put(makeDoc({ id: 'a' }))
    const before = (await documentRepository.get('a'))!.updatedAt
    await new Promise((r) => setTimeout(r, 5))
    await documentRepository.update('a', { title: 'Renamed' })
    const after = (await documentRepository.get('a'))!
    expect(after.title).toBe('Renamed')
    expect(after.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('delete() removes the document', async () => {
    await documentRepository.put(makeDoc({ id: 'a' }))
    await documentRepository.delete('a')
    expect(await documentRepository.get('a')).toBeUndefined()
  })

  it('listSince() returns documents at or after the given timestamp', async () => {
    await documentRepository.bulkPut([
      makeDoc({ id: 'a', createdAt: 1000 }),
      makeDoc({ id: 'b', createdAt: 3000 }),
      makeDoc({ id: 'c', createdAt: 5000 }),
    ])
    const list = await documentRepository.listSince(2000)
    expect(list.map((d) => d.id).sort()).toEqual(['b', 'c'])
  })

  it('clear() removes all documents', async () => {
    await documentRepository.bulkPut([makeDoc({ id: 'a' }), makeDoc({ id: 'b' })])
    await documentRepository.clear()
    expect(await documentRepository.count()).toBe(0)
  })
})
