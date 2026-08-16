import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildDigestMaterial, buildDigestDocument, maybeRunDailyDigest, DEFAULT_DIGEST_CONFIG } from './daily'
import { db } from '../../db/index'

describe('buildDigestMaterial', () => {
  it('lists captures and review stats', () => {
    const material = buildDigestMaterial({
      docs: [
        { title: '文章 A', siteName: '站点A', excerpt: '摘要在' } as any,
        { title: '文章 B' } as any,
      ],
      dueCount: 7,
      streak: 4,
      reviewedTotal: 120,
    })
    expect(material).toContain('剪藏了 2 篇')
    expect(material).toContain('《文章 A》（站点A）')
    expect(material).toContain('《文章 B》')
    expect(material).toContain('到期卡片 7 张')
    expect(material).toContain('连续打卡 4 天')
    expect(material).toContain('累计复习 120 张')
  })

  it('handles empty capture lists', () => {
    const material = buildDigestMaterial({ docs: [], dueCount: 0, streak: 0, reviewedTotal: 0 })
    expect(material).toContain('剪藏了 0 篇')
    expect(material).toContain('（无）')
  })
})

describe('buildDigestDocument', () => {
  it('builds a stable per-day digest entity', () => {
    const doc = buildDigestDocument('要点…', '2025-06-15')
    expect(doc.id).toBe('digest-2025-06-15')
    expect(doc.url).toBe('digest://2025-06-15')
    expect(doc.title).toBe('每日简报 · 2025-06-15')
    expect(doc.markdown).toContain('要点…')
    expect(doc.tags).toEqual(['digest'])
    expect(doc.extractionMethod).toBe('manual')
  })
})

describe('maybeRunDailyDigest', () => {
  beforeEach(async () => {
    await db.documents.clear()
    await db.kvMeta.clear()
    await db.models.clear()
    await db.flashcards.clear()
  })

  it('is a no-op when disabled, before the hour, or already run today', async () => {
    const at9am = new Date('2025-06-15T09:00:00')
    expect((await maybeRunDailyDigest(at9am)).reason).toBe('disabled')

    await db.kvMeta.put({ id: 'daily-digest-config', value: { ...DEFAULT_DIGEST_CONFIG, enabled: true, hour: 8 } })
    const at7am = new Date('2025-06-15T07:00:00')
    expect((await maybeRunDailyDigest(at7am)).reason).toBe('before-hour')

    await db.kvMeta.put({ id: 'daily-digest-state', value: { lastRunDate: '2025-06-15' } })
    expect((await maybeRunDailyDigest(at9am)).reason).toBe('already-ran')
  })

  it('generates and persists a digest once per day', async () => {
    await db.kvMeta.put({ id: 'daily-digest-config', value: { ...DEFAULT_DIGEST_CONFIG, enabled: true, hour: 8 } })
    await db.models.put({ id: 'm1', provider: 'openai-compatible', modelId: 'gpt', name: 'M', enabled: true, isDefault: true } as any)

    const chat = vi.fn().mockResolvedValue({ content: '## 昨日剪藏\n一切安好' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: '## 昨日剪藏\n一切安好' } }] }),
    }))
    // Route through createProvider — stub its chat by stubbing fetch above.

    const at9am = new Date('2025-06-15T09:00:00')
    const r = await maybeRunDailyDigest(at9am)
    expect(r.ran).toBe(true)
    expect(r.documentId).toBe('digest-2025-06-15')
    expect(await db.documents.get('digest-2025-06-15')).toBeTruthy()

    // Second run same day: already-ran.
    const r2 = await maybeRunDailyDigest(at9am)
    expect(r2.reason).toBe('already-ran')
    void chat
    vi.unstubAllGlobals()
  })
})
