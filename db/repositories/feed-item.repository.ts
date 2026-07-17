import dayjs from 'dayjs'
import { db } from '../index'
import type { FeedItemEntity } from '../../types/feed'

export const FeedItemRepository = {
  async findById(id: string): Promise<FeedItemEntity | undefined> {
    return db.feedItems.get(id)
  },

  async findByFeed(feedId: string): Promise<FeedItemEntity[]> {
    // [feedId+publishedAt] index lets us order newest-first efficiently.
    const items = await db.feedItems.where('feedId').equals(feedId).toArray()
    return items.sort((a, b) => {
      const ta = dayjs(a.publishedAt ?? a.fetchedAt).valueOf()
      const tb = dayjs(b.publishedAt ?? b.fetchedAt).valueOf()
      return tb - ta
    })
  },

  async findGuids(feedId: string): Promise<Set<string>> {
    const rows = await db.feedItems.where('feedId').equals(feedId).toArray()
    return new Set(rows.map((r) => r.guid))
  },

  async save(item: FeedItemEntity): Promise<FeedItemEntity> {
    await db.feedItems.put(item)
    return item
  },

  async bulkSave(items: FeedItemEntity[]): Promise<void> {
    if (items.length) await db.feedItems.bulkPut(items)
  },

  async markRead(id: string, readAt: string): Promise<void> {
    await db.feedItems.update(id, { readAt })
  },

  async setDocument(id: string, documentId: string, collectedAt: string): Promise<void> {
    await db.feedItems.update(id, { documentId, collectedAt })
  },

  async clearDocument(id: string): Promise<void> {
    await db.feedItems.update(id, { documentId: undefined, collectedAt: undefined })
  },

  async setCollectError(id: string, reason: string, at: string): Promise<void> {
    await db.feedItems.update(id, { collectError: reason, collectErrorAt: at })
  },

  async clearCollectError(id: string): Promise<void> {
    await db.feedItems.update(id, { collectError: undefined, collectErrorAt: undefined })
  },

  async clearAllCollectErrors(feedId: string): Promise<void> {
    const rows = await db.feedItems.where('feedId').equals(feedId).toArray()
    const failed = rows.filter((r) => r.collectError)
    if (!failed.length) return
    await db.feedItems.bulkPut(failed.map((r) => ({
      ...r,
      collectError: undefined,
      collectErrorAt: undefined,
    })))
  },

  async unreadCount(feedId?: string): Promise<number> {
    const col = feedId ? db.feedItems.where('feedId').equals(feedId) : db.feedItems.toCollection()
    const rows = await col.toArray()
    return rows.filter((r) => !r.readAt).length
  },

  async delete(id: string): Promise<void> {
    await db.feedItems.delete(id)
  },
}
