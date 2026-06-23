/**
 * M9 定时调度器（Service Worker Alarm）
 *
 * initAlarm: 创建 'rss-fetch' 定时 Alarm（默认 30 分钟）
 * handleAlarm: 处理 Alarm，依次拉取 → 去重 → 摘要 → 写入 → 更新 Badge
 *
 * 单 Feed 失败不影响其他 Feed（try/catch 隔离）
 */

import { rssRepo } from '@/lib/db/repositories/rss.repo'
import type { RSSArticleRecord } from '@/lib/db/types'
import { fetchFeed } from './fetcher'
import { computeArticleId, filterNewArticles } from './dedup'
import { summarizeArticle } from './summarizer'
import { updateBadge } from './badge'
import { getEngine } from '@/lib/providers/registry'
import { getKey } from '@/lib/providers/key-store'

export const RSS_ALARM_NAME = 'rss-fetch'

/** RSS 摘要配置（从 chrome.storage.local 读取） */
interface RssSchedulerConfig {
  aiSummaryEnabled?: boolean
  summaryProviderId?: string
  summaryModel?: string
}

const RSS_CONFIG_KEY = 'rc_rss_scheduler_config'

interface AlarmsApi {
  create(name: string, options: { delayInMinutes?: number; periodInMinutes: number }): void
}

interface StorageApi {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

function getAlarmsApi(): AlarmsApi | null {
  const c = typeof chrome !== 'undefined' ? chrome : undefined
  if (c && (c as unknown as Record<string, unknown>).alarms) {
    return (c as unknown as Record<string, unknown>).alarms as AlarmsApi
  }
  return null
}

function getStorageApi(): StorageApi | null {
  const c = typeof chrome !== 'undefined' ? chrome : undefined
  if (c && (c as unknown as Record<string, unknown>).storage) {
    const s = (c as unknown as Record<string, unknown>).storage as { local?: unknown }
    if (s?.local) return s.local as StorageApi
  }
  return null
}

/**
 * 创建或更新 rss-fetch Alarm。
 * 扩展安装时调用；intervalMinutes 默认 30。
 */
export function initAlarm(intervalMinutes = 30): void {
  const alarms = getAlarmsApi()
  if (!alarms) return
  alarms.create(RSS_ALARM_NAME, {
    delayInMinutes: intervalMinutes,
    periodInMinutes: intervalMinutes,
  })
}

/**
 * Alarm 触发时的处理函数。
 * 在 background.ts 中通过 chrome.alarms.onAlarm.addListener 注册。
 */
export async function handleAlarm(alarmName: string): Promise<void> {
  if (alarmName !== RSS_ALARM_NAME) return

  const config = await loadConfig()
  const feeds = await rssRepo.listFeeds()

  for (const feed of feeds) {
    try {
      // 1. 拉取
      const rawData = await fetchFeed(feed.url)

      // 2. 去重：构建已存在文章 ID 集合
      const existingIds = new Set(feed.articles.map((a) => a.id))

      // 3. 过滤新文章
      const newRawArticles = await filterNewArticles(rawData.items, existingIds)
      if (newRawArticles.length === 0) continue

      // 4. 为新文章生成摘要并构建 RSSArticleRecord
      const newArticles: RSSArticleRecord[] = []
      for (const rawArticle of newRawArticles) {
        const id = await computeArticleId(rawArticle)
        let summary = rawArticle.description.slice(0, 200)

        if (config.aiSummaryEnabled && config.summaryProviderId) {
          try {
            const engine = getEngine(config.summaryProviderId)
            const apiKey = (await getKey(config.summaryProviderId)) ?? ''
            summary = await summarizeArticle(
              rawArticle,
              engine,
              apiKey,
              config.summaryModel ?? 'gpt-4o-mini',
            )
          } catch (summaryErr) {
            console.error('[rss:scheduler] summarize failed for', rawArticle.link, summaryErr)
          }
        }

        newArticles.push({
          id,
          link: rawArticle.link,
          title: rawArticle.title,
          summary,
          publishedAt: rawArticle.pubDate,
          isRead: false,
        })
      }

      // 5. 写入存储
      await rssRepo.updateArticles(feed.id, newArticles)
    } catch (feedErr) {
      console.error(`[rss:scheduler] feed "${feed.url}" failed`, feedErr)
    }
  }

  // 6. 更新 Badge 未读计数
  await updateBadge()
}

/**
 * 保存 RSS 调度配置（供 Options 页面调用）
 */
export async function saveRssConfig(config: RssSchedulerConfig): Promise<void> {
  const storage = getStorageApi()
  if (storage) await storage.set({ [RSS_CONFIG_KEY]: config })
}

/**
 * 读取 RSS 调度配置
 */
export async function loadConfig(): Promise<RssSchedulerConfig> {
  const storage = getStorageApi()
  if (!storage) return {}
  const result = await storage.get(RSS_CONFIG_KEY)
  return (result[RSS_CONFIG_KEY] as RssSchedulerConfig | undefined) ?? {}
}
