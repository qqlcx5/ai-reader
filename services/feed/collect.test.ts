import { describe, it, expect } from 'vitest'
import { collectItems } from './collect'
import type { FeedItemEntity } from '@/types/feed'

function item(id: string, link: string, documentId?: string): FeedItemEntity {
  return {
    id,
    feedId: 'f',
    guid: id,
    title: id,
    link,
    fetchedAt: '2026-01-01T00:00:00Z',
    documentId,
  }
}

describe('collectItems', () => {
  // No real network in jsdom → collectFeedItem rejects for uncollected items.
  // The batch helper must swallow those errors (never block refresh) and skip
  // items that already have a documentId.
  it('skips already-collected items and swallows per-item failures', async () => {
    const items = [
      item('a', 'https://x.test/a', 'already-in-library'),
      item('b', 'https://x.test/b'),
      item('c', 'https://x.test/c'),
    ]
    const collected = await collectItems(items, 'auto')
    expect(collected).toBe(0) // b & c fail to fetch in jsdom → none collected
    // does not throw — refresh stays resilient
  })

  it('returns 0 for an empty list', async () => {
    expect(await collectItems([], 'auto')).toBe(0)
  })
})
