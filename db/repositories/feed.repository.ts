import { db } from '../index'
import type { FeedEntity } from '../../types/feed'

export const FeedRepository = {
  async findById(id: string): Promise<FeedEntity | undefined> {
    return db.feeds.get(id)
  },

  async findByUrl(url: string): Promise<FeedEntity | undefined> {
    return db.feeds.where('url').equalsIgnoreCase(url).first()
  },

  async findAll(): Promise<FeedEntity[]> {
    return db.feeds.orderBy('updatedAt').reverse().toArray()
  },

  async save(feed: FeedEntity): Promise<FeedEntity> {
    await db.feeds.put(feed)
    return feed
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.feeds, db.feedItems, async () => {
      await db.feedItems.where('feedId').equals(id).delete()
      await db.feeds.delete(id)
    })
  },

  async count(): Promise<number> {
    return db.feeds.count()
  },
}
