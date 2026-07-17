import dayjs from 'dayjs'
import { FeedRepository } from '@/db/repositories/feed.repository'
import { FeedItemRepository } from '@/db/repositories/feed-item.repository'
import { fetchFeed } from './fetch'
import { parseFeed } from './parser'
import { collectItems } from './collect'
import { normalizeFeedUrl } from '@/utils/feed/url'
import type { FeedEntity, FeedItemEntity } from '@/types/feed'

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export interface RefreshResult {
  feedId: string
  newItems: number
  error?: string
}

/** Fetch + parse one feed, inserting items not yet seen (dedupe by guid). */
export async function refreshFeed(feed: FeedEntity): Promise<RefreshResult> {
  try {
    const fetched = await fetchFeed(feed.url, { etag: feed.etag, lastModified: feed.lastModified })
    const now = dayjs().toISOString()

    if (fetched.notModified) {
      await FeedRepository.save({ ...feed, lastFetchedAt: now, lastError: undefined })
      return { feedId: feed.id, newItems: 0 }
    }

    const parsed = parseFeed(fetched.xml)
    const known = await FeedItemRepository.findGuids(feed.id)
    const fresh: FeedItemEntity[] = []
    for (const it of parsed.items) {
      const guid = it.guid || it.link
      if (!guid || known.has(guid)) continue
      fresh.push({
        id: uuid(),
        feedId: feed.id,
        guid,
        title: it.title,
        link: it.link,
        author: it.author,
        summary: it.summary,
        contentHtml: it.contentHtml,
        publishedAt: it.publishedAt,
        fetchedAt: now,
      })
    }

    await FeedItemRepository.bulkSave(fresh)
    await FeedRepository.save({
      ...feed,
      title: feed.title && feed.title !== feed.url ? feed.title : parsed.title,
      siteUrl: feed.siteUrl || parsed.siteUrl,
      description: parsed.description,
      etag: fetched.etag,
      lastModified: fetched.lastModified,
      lastFetchedAt: now,
      lastError: undefined,
      updatedAt: now,
    })

    // Auto-collect: opt-in per feed. Newly-inserted items (no documentId yet)
    // are fetched + defuddled into the library, best-effort, capped.
    if (feed.autoCollect && fresh.length) {
      await collectItems(fresh, 'auto')
    }

    return { feedId: feed.id, newItems: fresh.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await FeedRepository.save({ ...feed, lastFetchedAt: dayjs().toISOString(), lastError: msg })
    return { feedId: feed.id, newItems: 0, error: msg }
  }
}

export async function refreshAll(): Promise<RefreshResult[]> {
  const feeds = await FeedRepository.findAll()
  return Promise.all(feeds.map(refreshFeed))
}

/** Subscribe to a URL (dedupe by canonical URL) and do an initial fetch to fill
 *  items. The URL is normalized (lowercase scheme/host, tracking params and
 *  fragment stripped, trailing slash dropped) so the same feed subscribed via
 *  slightly different URLs — utm params, trailing slash, mixed case — resolves
 *  to one subscription instead of stacking duplicates. */
export async function addSubscription(url: string, folder?: string): Promise<FeedEntity> {
  const normalized = normalizeFeedUrl(url)
  const existing = await FeedRepository.findByUrl(normalized)
  if (existing) return existing

  const now = dayjs().toISOString()
  const feed: FeedEntity = {
    id: uuid(),
    url: normalized,
    title: normalized,
    folder: folder?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }
  await FeedRepository.save(feed)
  await refreshFeed(feed)
  return (await FeedRepository.findById(feed.id)) ?? feed
}
