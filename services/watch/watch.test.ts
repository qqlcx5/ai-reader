import { describe, it, expect, beforeEach } from 'vitest'
import { checkWatch, MAX_CHANGES, PageWatchRepository } from './watch'
import { db } from '../../db/index'
import type { PageWatchEntity } from '../../types/page-watch'

function makeWatch(overrides: Partial<PageWatchEntity> = {}): PageWatchEntity {
  const now = new Date().toISOString()
  return {
    id: 'w1', url: 'https://example.com/page', title: '监控页', enabled: true,
    createdAt: now, updatedAt: now, ...overrides,
  }
}

const NOW = new Date('2025-06-15T10:00:00')

describe('checkWatch', () => {
  it('first check records hash without marking a change', async () => {
    const extract = async () => ({ contentHash: 'h1', markdown: '# 内容 v1', title: '标题' })
    const { changed, watch } = await checkWatch(makeWatch(), extract, NOW)
    expect(changed).toBe(false)
    expect(watch.lastHash).toBe('h1')
    expect(watch.lastCheckedAt).toBe(NOW.toISOString())
    expect(watch.changes).toBeUndefined()
  })

  it('hash change records history with previous excerpt', async () => {
    const watch = makeWatch({ lastHash: 'h1', lastMarkdownExcerpt: '# 内容 v1 老版本正文' })
    const extract = async () => ({ contentHash: 'h2', markdown: '# 内容 v2', title: '标题' })
    const { changed, watch: updated } = await checkWatch(watch, extract, NOW)
    expect(changed).toBe(true)
    expect(updated.lastChangedAt).toBe(NOW.toISOString())
    expect(updated.changes?.[0].previousExcerpt).toContain('老版本正文')
    expect(updated.lastMarkdownExcerpt).toBe('# 内容 v2')
  })

  it('same hash is a no-change and extraction failures set lastError', async () => {
    const watch = makeWatch({ lastHash: 'h1' })
    const same = await checkWatch(watch, async () => ({ contentHash: 'h1', markdown: 'x' }), NOW)
    expect(same.changed).toBe(false)
    expect(same.watch.changes).toBeUndefined()

    const fail = await checkWatch(watch, async () => { throw new Error('boom') }, NOW)
    expect(fail.error).toBe('boom')
    expect(fail.watch.lastError).toBe('boom')
  })

  it('caps change history', async () => {
    let watch = makeWatch({ lastHash: 'h0', lastMarkdownExcerpt: 'x' })
    for (let i = 1; i <= MAX_CHANGES + 5; i++) {
      const r = await checkWatch(watch, async () => ({ contentHash: `h${i}`, markdown: `v${i}` }), NOW)
      watch = r.watch
    }
    expect(watch.changes?.length).toBe(MAX_CHANGES)
  })
})

describe('PageWatchRepository', () => {
  beforeEach(async () => {
    await db.pageWatches.clear()
  })

  it('saves, filters enabled, deletes', async () => {
    await PageWatchRepository.save(makeWatch({ id: 'a', enabled: true }))
    await PageWatchRepository.save(makeWatch({ id: 'b', enabled: false }))
    expect((await PageWatchRepository.findEnabled()).map((w) => w.id)).toEqual(['a'])
    expect((await PageWatchRepository.findAll())).toHaveLength(2)
    await PageWatchRepository.delete('a')
    expect(await PageWatchRepository.findAll()).toHaveLength(1)
  })
})
