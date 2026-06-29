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

import { runSync, forceUpload, forceDownload } from './sync.service'
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
    extractionMethod: 'manual' as const,
    source: 'library' as const,
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

  it('forceUpload overwrites remote and resets base so a following sync no-ops', async () => {
    await db.documents.put(doc('d1', '2026-01-01T00:00:00Z'))

    // Seed remote with something else (would normally pull/merge).
    store['data.json'] = JSON.stringify({
      version: 1,
      syncedAt: '2026-01-01T00:00:00Z',
      data: { ...{ documents: [doc('remote-only', '2026-01-01T00:00:00Z')] } },
    })

    await forceUpload(cfg)

    const snap = JSON.parse(store['data.json'])
    expect(snap.data.documents.map((d: any) => d.id).sort()).toEqual(['d1'])
    expect(snap.data.documents.find((d: any) => d.id === 'remote-only')).toBeUndefined()

    // Next sync is a no-op (local == remote == base).
    const r = await runSync(cfg)
    expect(r.pushed).toBe(0)
    expect(r.pulled).toBe(0)
  })

  it('aborts and preserves local data when the remote is wiped (no mass delete)', async () => {
    for (let i = 0; i < 6; i++) await db.documents.put(doc(`d${i}`, '2026-01-01T00:00:00Z'))
    await runSync(cfg) // push

    // Simulate the user deleting everything on the cloud side.
    Object.keys(store).forEach((k) => delete store[k])

    await expect(runSync(cfg)).rejects.toThrow(/中止/)

    // Local data must be untouched.
    expect(await db.documents.count()).toBe(6)
  })

  it('forceDownload overwrites local with remote and resets base', async () => {
    // Remote has d1+d2; local has a stale doc that should be wiped.
    await db.documents.put(doc('local-only', '2026-01-01T00:00:00Z'))
    store['data.json'] = JSON.stringify({
      version: 1,
      syncedAt: '2026-01-01T00:00:00Z',
      data: {
        ...{ documents: [doc('d1', '2026-01-01T00:00:00Z'), doc('d2', '2026-01-02T00:00:00Z')] },
      },
    })

    await forceDownload(cfg)
    const ids = (await db.documents.toArray()).map((d) => d.id).sort()
    expect(ids).toEqual(['d1', 'd2'])

    // Next sync is a no-op.
    const r = await runSync(cfg)
    expect(r.pushed).toBe(0)
    expect(r.pulled).toBe(0)
  })
})
