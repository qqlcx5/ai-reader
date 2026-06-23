/**
 * M9 RSS 流水线编排器
 *
 * runFeedPipeline: 对单个 Feed 执行完整的 fetch → dedup → save 流程
 * （AI 摘要由 scheduler.ts 统一管理；此处仅做基础持久化流水线）
 */

import { rssRepo } from '@/lib/db/repositories/rss.repo'
import type { RSSFeedRecord, RSSArticleRecord } from '@/lib/db/types'
import { fetchFeed } from './fetcher'
import { computeArticleId, filterNewArticles } from './dedup'
import { updateBadge } from './badge'

export interface PipelineResult {
  feedId: string
  newItems: number
  error?: string
}

/**
 * 对单个 Feed 执行完整的拉取 → 去重 → 写入流水线。
 * AI 摘要降级为 description.slice(0, 200)。
 */
export async function runFeedPipeline(feed: RSSFeedRecord): Promise<PipelineResult> {
  try {
    const rawData = await fetchFeed(feed.url)
    const existingIds = new Set(feed.articles.map((a) => a.id))
    const newRawArticles = await filterNewArticles(rawData.items, existingIds)

    if (newRawArticles.length === 0) {
      return { feedId: feed.id, newItems: 0 }
    }

    const newArticles: RSSArticleRecord[] = []
    for (const raw of newRawArticles) {
      const id = await computeArticleId(raw)
      newArticles.push({
        id,
        link: raw.link,
        title: raw.title,
        summary: raw.description.slice(0, 200),
        publishedAt: raw.pubDate,
        isRead: false,
      })
    }

    await rssRepo.updateArticles(feed.id, newArticles)
    await updateBadge()

    return { feedId: feed.id, newItems: newArticles.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[rss:pipeline] feed ${feed.id} failed:`, message)
    return { feedId: feed.id, newItems: 0, error: message }
  }
}
