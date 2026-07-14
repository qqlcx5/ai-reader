import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FeedItemEntity } from '@/types/feed'
import type { FeedEntity } from '@/types/feed'

// Mock all external dependencies — bg-refresh touches DB, network, offscreen, search
vi.mock('@/db/repositories/feed.repository', () => ({
  FeedRepository: {
    findById: vi.fn(),
    save: vi.fn(),
    findAll: vi.fn(),
  },
}))

vi.mock('@/db/repositories/feed-item.repository', () => ({
  FeedItemRepository: {
    findByFeed: vi.fn(),
    findGuids: vi.fn(),
    bulkSave: vi.fn(),
    setDocument: vi.fn(),
    setCollectError: vi.fn(),
    clearCollectError: vi.fn(),
    clearAllCollectErrors: vi.fn(),
  },
}))

vi.mock('@/db/repositories/document.repository', () => ({
  DocumentRepository: {
    save: vi.fn(),
  },
}))

vi.mock('@/services/feed/fetch', () => ({
  fetchFeed: vi.fn(),
}))

vi.mock('@/services/offscreen/manager', () => ({
  sendToOffscreen: vi.fn(),
}))

vi.mock('@/services/search', () => ({
  addToIndex: vi.fn(),
}))

vi.mock('@/services/ai-job/queue', () => ({
  enqueueForDocument: vi.fn(),
}))

// Import after mocks are set up
import { FeedRepository } from '@/db/repositories/feed.repository'
import { FeedItemRepository } from '@/db/repositories/feed-item.repository'
import { collectFeedItems, collectBatch } from './bg-refresh'

function makeItem(id: string, opts: Partial<FeedItemEntity> = {}): FeedItemEntity {
  return {
    id,
    feedId: 'feed-1',
    guid: id,
    title: `Item ${id}`,
    link: `https://example.com/${id}`,
    fetchedAt: '2026-01-01T00:00:00Z',
    ...opts,
  }
}

describe('collectBatch — collectError filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips items that have a collectError marker', async () => {
    const items = [
      makeItem('a', { collectError: 'previous failure' }),
      makeItem('b', { collectError: 'previous failure' }),
    ]
    // collectBatch should filter out all items with collectError → empty result
    const result = await collectBatch(items, 'auto', 200)
    expect(result.total).toBe(0)
    expect(result.collected).toBe(0)
    expect(result.failed).toBe(0)
    // Should not attempt to collect any items
    expect(FeedItemRepository.setCollectError).not.toHaveBeenCalled()
    expect(FeedItemRepository.setDocument).not.toHaveBeenCalled()
  })

  it('includes items without collectError', async () => {
    const items = [
      makeItem('a'), // no collectError, no documentId
      makeItem('b', { documentId: 'doc-1' }), // already collected → skip
    ]
    // With only 1 uncollected item, collectBatch will try to collect it
    // but extractItemContent will fail (no offscreen in test env) → all retries fail
    const result = await collectBatch(items, 'auto', 200)
    expect(result.total).toBe(1) // only item 'a' is eligible
    expect(result.collected).toBe(0) // extraction fails in test env
    expect(result.failed).toBe(1) // 'a' fails after retries
    // Should have persisted the failure
    expect(FeedItemRepository.setCollectError).toHaveBeenCalledWith('a', expect.any(String), expect.any(String))
  })
})

describe('collectFeedItems — stale memory fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears collectError and re-loads items from DB before collecting', async () => {
    // First call: items have collectError set
    const staleItems = [
      makeItem('a', { collectError: 'old failure' }),
      makeItem('b', { collectError: 'old failure' }),
    ]
    // Second call (after clearAllCollectErrors): items have collectError cleared
    const clearedItems = [
      makeItem('a'), // collectError cleared
      makeItem('b'), // collectError cleared
    ]

    vi.mocked(FeedRepository.findById).mockResolvedValue({
      id: 'feed-1',
      url: 'https://example.com/feed',
      title: 'Test Feed',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as FeedEntity)

    // First findByFeed returns items with collectError; second returns cleared items
    vi.mocked(FeedItemRepository.findByFeed)
      .mockResolvedValueOnce(staleItems)   // initial load (uncollected filter)
      .mockResolvedValueOnce(clearedItems) // post-clear reload

    vi.mocked(FeedItemRepository.clearAllCollectErrors).mockResolvedValue(undefined)

    // collectBatch will try to collect 'a' and 'b' but both fail (no offscreen in test)
    const result = await collectFeedItems('feed-1')

    // Should have called clearAllCollectErrors
    expect(FeedItemRepository.clearAllCollectErrors).toHaveBeenCalledWith('feed-1')

    // Should have called findByFeed twice (initial + post-clear reload)
    expect(FeedItemRepository.findByFeed).toHaveBeenCalledTimes(2)

    // Both items should have been attempted (collectError cleared)
    expect(result.total).toBe(2)
    expect(result.collected).toBe(0) // fails in test env
    expect(result.failed).toBe(2)
  })

  it('returns early if no uncollected items', async () => {
    vi.mocked(FeedRepository.findById).mockResolvedValue({
      id: 'feed-1',
      url: 'https://example.com/feed',
      title: 'Test Feed',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as FeedEntity)

    vi.mocked(FeedItemRepository.findByFeed).mockResolvedValue([
      makeItem('a', { documentId: 'doc-1' }), // already collected
    ])

    const result = await collectFeedItems('feed-1')

    expect(result.total).toBe(0)
    expect(result.collected).toBe(0)
    expect(result.failed).toBe(0)
    // Should NOT have called clearAllCollectErrors (nothing to collect)
    expect(FeedItemRepository.clearAllCollectErrors).not.toHaveBeenCalled()
  })
})
