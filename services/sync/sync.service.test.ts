import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/db'

// In-memory fake WebDAV remote (path-aware).
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
    async putText(path: string, text: string) {
      store[path] = text
    },
    async getText(path: string) {
      if (store[path] == null) throw new Error(`not found: ${path}`)
      return store[path]
    },
    async remove(path: string) {
      delete store[path]
    },
  }),
}))

import { runSync, previewSync, forceUpload, forceDownload } from './sync.service'
import type { WebDAVConfig } from '@/types/sync'

const cfg: WebDAVConfig = { url: 'x', username: 'u', password: 'p', basePath: '/auramind', enabled: true }

async function resetDB() {
  await Promise.all(
    [db.documents, db.conversations, db.models, db.collections, db.collectionItems, db.settings, db.kvMeta, db.feeds].map((t) =>
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

  it('excludes raw fields (rawHtml / rawText) from the backup, keeps markdown', async () => {
    await db.documents.put({
      ...doc('d1', '2026-01-01T00:00:00Z'),
      rawHtml: '<html>',
      rawHtmlCompressed: false,
      rawText: 'raw text',
    } as any)
    await runSync(cfg)

    const snap = JSON.parse(store['data.json'])
    const d = snap.data.documents.find((x: any) => x.id === 'd1')
    expect(d.rawHtml).toBeUndefined()
    expect(d.rawHtmlCompressed).toBeUndefined()
    expect(d.rawText).toBeUndefined()
    expect(d.markdown).toBe('m') // markdown body is kept
  })

  it('syncs feeds across devices (remote-only feed pulled into a fresh device)', async () => {
    await db.feeds.put({
      id: 'f1',
      url: 'https://a.test/rss',
      title: 'A',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    await runSync(cfg) // push from device A

    // Simulate device B: empty local + no sync state.
    await db.feeds.clear()
    await db.kvMeta.clear()

    const r = await runSync(cfg)
    expect(r.pulled).toBeGreaterThanOrEqual(1)
    expect(await db.feeds.get('f1')).toBeTruthy()
  })

  it('aborts and preserves remote when local is wiped but sync-state persists', async () => {
    for (let i = 0; i < 6; i++) await db.documents.put(doc(`d${i}`, '2026-01-01T00:00:00Z'))
    await runSync(cfg) // push; base now records 6

    // Local documents wiped, but kvMeta (sync-state/base) intentionally persists.
    await db.documents.clear()

    await expect(runSync(cfg)).rejects.toThrow(/中止/)
    // Remote must be untouched (no mass delete propagated).
    const snap = JSON.parse(store['data.json'])
    expect(snap.data.documents.length).toBe(6)
  })

  it('writes a backup snapshot before overwriting the remote', async () => {
    await db.documents.put(doc('d1', '2026-01-01T00:00:00Z'))
    await runSync(cfg)
    const firstSnapshot = store['data.json']
    expect(store['data.backup.json']).toBeUndefined() // nothing to back up on first push

    // Add a doc and sync again — previous remote should be backed up.
    await db.documents.put(doc('d2', '2026-01-02T00:00:00Z'))
    await runSync(cfg)

    expect(store['data.backup.json']).toBe(firstSnapshot)
  })

  it('previewSync reports counts without writing anything', async () => {
    await db.documents.put(doc('d1', '2026-01-01T00:00:00Z'))
    await runSync(cfg) // push

    // Simulate a remote-only new doc.
    const snap = JSON.parse(store['data.json'])
    snap.data.documents.push(doc('d2', '2026-01-02T00:00:00Z'))
    store['data.json'] = JSON.stringify(snap)

    const before = store['data.json']
    const p = await previewSync(cfg)
    expect(p.pulled).toBeGreaterThanOrEqual(1)
    expect(p.deletedLocal).toBe(0)
    expect(p.deletedRemote).toBe(0)
    // Pure dry-run: no writes.
    expect(store['data.json']).toBe(before)
    expect(store['data.backup.json']).toBeUndefined()
  })
})
