/**
 * M8 存储与数据层 — RSSFeeds Repository
 *
 * articles 内联存储在 RSSFeedRecord 中（避免额外表连接）。
 * 哈希去重：合并文章时以 id 为键去重。
 */

import { getDb } from '../database'
import type { RSSFeedRecord, RSSArticleRecord } from '../types'

export class RSSRepository {
  private get table() {
    return getDb().rssFeeds
  }

  async saveFeed(feed: RSSFeedRecord): Promise<void> {
    await this.table.put(feed)
  }

  /**
   * 合并更新文章列表：以 article.id（SHA-256 hash）去重，
   * 保留旧文章的 isRead 状态，新文章追加到头部。
   */
  async updateArticles(feedId: string, articles: RSSArticleRecord[]): Promise<void> {
    const feed = await this.table.get(feedId)
    if (!feed) return

    const existingMap = new Map(feed.articles.map((a) => [a.id, a]))
    for (const article of articles) {
      if (!existingMap.has(article.id)) {
        existingMap.set(article.id, article)
      }
    }

    // 按发布时间倒序排列
    const merged = Array.from(existingMap.values()).sort((a, b) => b.publishedAt - a.publishedAt)

    await this.table.update(feedId, {
      articles: merged,
      lastFetched: Date.now(),
    })
  }

  async markAsRead(feedId: string, articleId: string): Promise<void> {
    const feed = await this.table.get(feedId)
    if (!feed) return
    await this.table.update(feedId, {
      articles: feed.articles.map((a) => (a.id === articleId ? { ...a, isRead: true } : a)),
    })
  }

  async listFeeds(): Promise<RSSFeedRecord[]> {
    return this.table.orderBy('url').toArray()
  }

  async getUnreadCount(): Promise<number> {
    const feeds = await this.table.toArray()
    return feeds.reduce((sum, feed) => sum + feed.articles.filter((a) => !a.isRead).length, 0)
  }

  async delete(feedId: string): Promise<void> {
    await this.table.delete(feedId)
  }
}

export const rssRepo = new RSSRepository()
