import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchInboxItems, itemToDocument, pollInbox } from './inbox'
import { db } from '../../db/index'
import { SettingsRepository } from '../../db/repositories/settings.repository'
import { MetaRepository } from '../../db/repositories/meta.repository'
import { DocumentRepository } from '../../db/repositories/document.repository'

function makeItem(overrides: Partial<Parameters<typeof itemToDocument>[0]> = {}) {
  return {
    id: 'mail-1',
    from: 'weekly@example.com',
    subject: '第 1 期',
    html: '<p>这是正文内容，长度足够被收录。</p>',
    receivedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('fetchInboxItems', () => {
  it('sends cursor and bearer token, returns parsed items', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [makeItem()], cursor: 'c2' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchInboxItems('https://inbox.example.com/inbox', 'tok', 'c1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe('https://inbox.example.com/inbox?cursor=c1')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(res.items).toHaveLength(1)
    expect(res.cursor).toBe('c2')
    vi.unstubAllGlobals()
  })

  it('throws a descriptive error on non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(fetchInboxItems('https://x.dev/inbox', 'bad')).rejects.toThrow('HTTP 401')
    vi.unstubAllGlobals()
  })
})

describe('itemToDocument', () => {
  it('converts an html mail into a newsletter document', async () => {
    const doc = await itemToDocument(makeItem())
    expect(doc).not.toBeNull()
    expect(doc!.title).toBe('第 1 期')
    expect(doc!.siteName).toBe('weekly@example.com')
    expect(doc!.tags).toEqual(['newsletter'])
    expect(doc!.markdown).toContain('正文内容')
    expect(doc!.id).toBe(doc!.contentHash)
  })

  it('uses plain text when no html part', async () => {
    const doc = await itemToDocument(makeItem({ html: undefined, text: '纯文本正文' }))
    expect(doc!.markdown).toBe('纯文本正文')
  })

  it('returns null when the mail has no body at all', async () => {
    expect(await itemToDocument(makeItem({ html: '  ', text: '' }))).toBeNull()
  })
})

describe('pollInbox', () => {
  beforeEach(async () => {
    await db.documents.clear()
    await db.kvMeta.clear()
    await db.settings.clear()
  })

  it('collects mails, dedupes by hash, and advances the cursor', async () => {
    await SettingsRepository.save({
      id: 'app-settings',
      context: {} as any,
      capture: {} as any,
      autoAnalysis: {},
      inbox: { endpoint: 'https://x.dev/inbox', token: 'tok', enabled: true },
      createdAt: '',
      updatedAt: '',
    } as any)

    const items = [makeItem(), makeItem({ id: 'mail-2', subject: '第 2 期', html: '<p>第二期完全不同的正文内容。</p>' })]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items, cursor: 'next' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const r1 = await pollInbox()
    expect(r1.collected).toBe(2)
    expect(r1.error).toBeUndefined()
    expect(await DocumentRepository.count?.()).toBe(2)
    expect(await MetaRepository.get('inbox-cursor')).toBe('next')

    // Second poll returns the same mails → deduped, cursor untouched.
    const r2 = await pollInbox()
    expect(r2.collected).toBe(0)
    expect(r2.skipped).toBe(2)

    vi.unstubAllGlobals()
  })

  it('is a no-op when inbox is disabled', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const r = await pollInbox()
    expect(r.collected).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
