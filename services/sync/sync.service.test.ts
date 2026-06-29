import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/db'

// In-memory fake WebDAV remote.
const store: Record<string, string> = {}
vi.mock('../webdav/webdav.client', () => ({
  normalizeBasePath: (p: string) => p || '/auramind',
  createWebDAVRemote: () => ({
    async test() {
      return { ok: true }
    },
    async hasData() {
      return !!store['data.json']
    },
    async putText(_path: string, text: string) {
      store['data.json'] = text
    },
    async getText(_path: string) {
      return store['data.json']
    },
    async remove() {},
  }),
}))

import { runSync } from './sync.service'
import type { WebDAVConfig } from '@/types/sync'

const cfg: WebDAVConfig = { url: 'x', username: 'u', password: 'p', basePath: '/auramind', enabled: true }

async function resetDB() {
  await Promise.all(
    [db.documents, db.conversations, db.models, db.collections, db.collectionItems, db.settings, db.kvMeta].map((t) =>
      t.clear(),
    ),
  )
}

function doc(id: string, updatedAt: string) {
  return {
    id,
    url: 'https://x',
    title: 'T',
    markdown: 'm',
    wordCount: 1,
    tokenCount: 1,
    contentHash: 'h',
    extractionMethod: 'manual',
    source: 'library',
    capturedAt: '2026-01-01T00:00:00Z',
    updatedAt,
  }
}

describe('runSync (integration)', () => {
  beforeEach(async () => {
    Object.keys(store).forEach((k) => delete store[k])
    await resetDB()
  })

  it('pushes local data on first sync and is a no-op on second', async () => {
    await db.documents.put(doc('d1', '2026-01-01T00:00:00Z'))

    const r1 = await runSync(cfg)
    expect(r1.pushed).toBeGreaterThanOrEqual(1)

    const r2 = await runSync(cfg)
    expect(r2.pushed).toBe(0)
    expect(r2.pulled).toBe(0)
  })

  it('propagates a local deletion to the remote via the base', async () => {
    await db.documents.put(doc('d1', '2026-01-01T00:00:00Z'))
    await runSync(cfg)

    await db.documents.delete('d1')
    const r3 = await runSync(cfg)
    expect(r3.deletedRemote).toBeGreaterThanOrEqual(1)

    const snap = JSON.parse(store['data.json'])
    expect(snap.data.documents.find((d: any) => d.id === 'd1')).toBeUndefined()
  })

  it('merges a remote-only new document into local on pull', async () => {
    await db.documents.put(doc('d1', '2026-01-01T00:00:00Z'))
    await runSync(cfg)

    // Simulate another device adding a doc remotely.
    const snap = JSON.parse(store['data.json'])
    snap.data.documents.push(doc('d2', '2026-01-02T00:00:00Z'))
    store['data.json'] = JSON.stringify(snap)

    const r = await runSync(cfg)
    expect(r.pulled).toBeGreaterThanOrEqual(1)
    expect(await db.documents.get('d2')).toBeTruthy()
  })
})
