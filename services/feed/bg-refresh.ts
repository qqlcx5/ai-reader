import dayjs from 'dayjs'
/**
 * Background-side feed refresh — runs entirely in the service worker via
 * offscreen document for DOM operations. Does NOT depend on the side panel
 * being open.
 *
 * Flow:
 *   alarm (30min) or panel-open stale check
 *     → refreshAllFeeds()
 *       → for each feed: refreshOneFeed()
 *         → fetchFeed (conditional GET)
 *         → sendToOffscreen('PARSE_FEED', xml)
 *         → dedupe by guid → bulkSave
 *         → if autoCollect: collectBatch()
 *           → concurrent (max 5) fetch + extract via offscreen
 *           → timeout 8s per item, retry up to 2 times
 *           → quality gate: per-feed minWords (default 200)
 */

import { FeedRepository } from '@/db/repositories/feed.repository'
import { FeedItemRepository } from '@/db/repositories/feed-item.repository'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { fetchFeed } from '@/services/feed/fetch'
import { sendToOffscreen } from '@/services/offscreen/manager'
import { addToIndex } from '@/services/search'
import { enqueueForDocument } from '@/services/ai-job/queue'
import type { FeedEntity, FeedItemEntity } from '@/types/feed'
import type { DocumentEntity, ExtractionMethod } from '@/types/document'
import type { ParsedFeed } from '@/services/feed/parser'

const browser: any = (globalThis as any).browser ?? (globalThis as any).chrome

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MIN_WORDS = 200
const FETCH_TIMEOUT_MS = 8000
const MAX_CONCURRENCY = 5
const MAX_COLLECT_PER_RUN = 10
const MAX_RETRIES = 2

/** How long before a failed collect item gets an automatic retry.
 *  24h: covers transient issues (rate-limits, temporary outages) without
 *  re-hammering permanently broken URLs every 30 min. */
const COLLECT_ERROR_TTL_MS = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BgRefreshResult {
  feedId: string
  newItems: number
  collected: number
  errors: string[]
}

export interface CollectItemResult {
  itemId: string
  title: string
  link: string
  ok: boolean
  reason?: string  // failure reason or skip reason
  documentId?: string
  wordCount?: number
}

export interface CollectResult {
  total: number
  collected: number
  failed: number
  items: CollectItemResult[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** fetch with timeout — aborts after FETCH_TIMEOUT_MS */
async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Core: refresh one feed
// ---------------------------------------------------------------------------

export async function refreshOneFeed(feed: FeedEntity): Promise<BgRefreshResult> {
  const errors: string[] = []
  let newItems = 0
  let collected = 0

  try {
    const fetched = await fetchFeed(feed.url, {
      etag: feed.etag,
      lastModified: feed.lastModified,
    })
    const now = dayjs().toISOString()

    if (fetched.notModified) {
      await FeedRepository.save({ ...feed, lastFetchedAt: now, lastError: undefined })
      return { feedId: feed.id, newItems: 0, collected: 0, errors }
    }

    // Parse via offscreen document (has DOMParser)
    const result = await sendToOffscreen<{ ok: boolean; feed?: ParsedFeed; error?: string }>({
      type: 'PARSE_FEED',
      xml: fetched.xml,
    })

    if (!result?.ok || !result.feed) {
      const msg = result?.error || 'Parse failed'
      await FeedRepository.save({ ...feed, lastFetchedAt: now, lastError: msg })
      return { feedId: feed.id, newItems: 0, collected: 0, errors: [msg] }
    }

    const parsed = result.feed
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

    newItems = fresh.length

    // Auto-collect
    if (feed.autoCollect && fresh.length) {
      const minWords = (feed as any).autoCollectMinWords as number | undefined
      const collectRes = await collectBatch(fresh, 'auto', minWords ?? DEFAULT_MIN_WORDS)
      collected = collectRes.collected
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(msg)
    await FeedRepository.save({
      ...feed,
      lastFetchedAt: dayjs().toISOString(),
      lastError: msg,
    })
  }

  return { feedId: feed.id, newItems, collected, errors }
}

// ---------------------------------------------------------------------------
// Flush enqueue-skip notifications after a full refresh cycle.

// ---------------------------------------------------------------------------
// Collect all uncollected items for a single feed (panel-requested)
// ---------------------------------------------------------------------------

export async function collectFeedItems(feedId: string): Promise<CollectResult> {
  const feed = await FeedRepository.findById(feedId)
  if (!feed) return { total: 0, collected: 0, failed: 0, items: [] }
  const all = await FeedItemRepository.findByFeed(feedId)
  const uncollected = all.filter((i) => !i.documentId)
  if (!uncollected.length) return { total: 0, collected: 0, failed: 0, items: [] }
  // User-initiated retry: clear previous failure markers so failed items get
  // a fresh shot. Without this, collectBatch would skip items whose collectError
  // is set (they'd stay stuck forever).
  await FeedItemRepository.clearAllCollectErrors(feedId).catch(() => {})
  // Re-load items after clearing errors so the in-memory array reflects the
  // cleared state (collectBatch filters on i.collectError).
  const refreshed = await FeedItemRepository.findByFeed(feedId)
  const toCollect = refreshed.filter((i) => !i.documentId)
  if (!toCollect.length) return { total: 0, collected: 0, failed: 0, items: [] }
  const minWords = (feed as any).autoCollectMinWords as number | undefined
  const result = await collectBatch(toCollect, 'auto', minWords ?? DEFAULT_MIN_WORDS)
  // Notify panel to reload its item list
  try {
    ;(browser as any)?.runtime?.sendMessage?.({
      type: 'FEEDS_COLLECTED',
      feedId,
      collected: result.collected,
      items: result.items,
    })
  } catch { /* panel may not be open */ }
  return result
}

// ---------------------------------------------------------------------------
// Refresh all feeds
// ---------------------------------------------------------------------------

export async function refreshAllFeeds(): Promise<BgRefreshResult[]> {
  const feeds = await FeedRepository.findAll()
  // Process feeds in parallel (fetch is I/O-bound)
  const results = await Promise.all(feeds.map(refreshOneFeed))
  // After all feeds are refreshed, flush any pending enqueue-skip notification.
  try {
    const { notifyEnqueueSkips } = await import('@/services/ai-job/queue')
    notifyEnqueueSkips()
  } catch { /* best-effort */ }
  return results
}

// ---------------------------------------------------------------------------
// Collect: fetch article → extract → save as DocumentEntity
// ---------------------------------------------------------------------------

interface CollectTask {
  item: FeedItemEntity
  minWords: number
  origin: 'manual' | 'auto'
}

/**
 * Collect a batch of feed items concurrently. Caps parallelism at
 * MAX_CONCURRENCY and total items at MAX_COLLECT_PER_RUN.
 */
export async function collectBatch(
  items: FeedItemEntity[],
  origin: 'manual' | 'auto',
  minWords: number = DEFAULT_MIN_WORDS,
): Promise<CollectResult> {
  // Skip items that already have a document. For items with a collectError,
  // only skip if the error is still within the TTL window — expired errors
  // get cleared so the item gets a fresh automatic retry.
  const now = Date.now()
  const toCollect = items
    .filter((i) => {
      if (i.documentId) return false
      if (!i.collectError) return true
      // Error exists — check TTL
      const errorAge = i.collectErrorAt
        ? now - new Date(i.collectErrorAt).getTime()
        : Infinity
      if (errorAge >= COLLECT_ERROR_TTL_MS) {
        // TTL expired — clear the error so this item gets retried
        FeedItemRepository.clearCollectError(i.id)?.catch?.(() => {})
        return true
      }
      return false
    })
    .slice(0, MAX_COLLECT_PER_RUN)

  if (!toCollect.length) return { total: 0, collected: 0, failed: 0, items: [] }

  // Simple concurrency limiter
  const queue = [...toCollect]
  const results: CollectItemResult[] = []

  async function worker() {
    while (queue.length) {
      const item = queue.shift()!
      const r = await collectOneItem(item, origin, minWords)
      results.push(r)
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENCY, toCollect.length) },
    () => worker(),
  )
  await Promise.all(workers)

  return {
    total: toCollect.length,
    collected: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    items: results,
  }
}

async function collectOneItem(
  item: FeedItemEntity,
  origin: 'manual' | 'auto',
  minWords: number,
): Promise<CollectItemResult> {
  const base: CollectItemResult = { itemId: item.id, title: item.title, link: item.link, ok: false }

  let lastError = ''
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await extractItemContent(item)
      if (!data) throw new Error('无法获取正文')

      // Quality gate (auto only)
      if (origin === 'auto' && data.wordCount < minWords) {
        throw new Error(`正文过短（${data.wordCount} 词 < ${minWords}）`)
      }

      const now = dayjs().toISOString()
      const entity: DocumentEntity = {
        id: data.contentHash,
        url: data.url || item.link,
        canonicalUrl: data.canonicalUrl,
        title: data.title || item.title,
        siteName: data.siteName,
        author: data.author || item.author,
        description: data.description,
        publishedAt: data.publishedAt || item.publishedAt,
        markdown: data.markdown,
        wordCount: data.wordCount,
        tokenCount: data.tokenCount,
        contentHash: data.contentHash,
        extractionMethod: data.extractionMethod,
        source: 'library',
        feedOrigin: origin,
        capturedAt: now,
        updatedAt: now,
      }

      const saved = await DocumentRepository.save(entity)
      await FeedItemRepository.setDocument(item.id, saved.id, now)
      // Success — clear any previous failure marker
      await FeedItemRepository.clearCollectError(item.id).catch(() => {})
      try {
        addToIndex(saved)
      } catch {
        // best-effort
      }

      if (origin === 'auto') {
        try {
          await enqueueForDocument(entity.id)
        } catch {
          // best-effort
        }
      }

      return { ...base, ok: true, documentId: saved.id, wordCount: data.wordCount }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      if (attempt < MAX_RETRIES) {
        console.warn(`[bg] collect retry ${attempt + 1}/${MAX_RETRIES}:`, item.link, e)
        // Brief backoff before retry
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      } else {
        console.warn(`[bg] collect exhausted retries:`, item.link, e)
      }
    }
  }
  // All retries exhausted — persist the failure so the next auto-collect run
  // skips this item and the user can see *why* it failed. Manual retries
  // (panel "collect" button) clear this flag first.
  try {
    await FeedItemRepository.setCollectError(item.id, lastError, dayjs().toISOString())
  } catch {
    // best-effort
  }
  return { ...base, ok: false, reason: lastError }
}

// ---------------------------------------------------------------------------
// Content extraction — RSS body first, then fetch original page
// ---------------------------------------------------------------------------

interface ExtractedData {
  url: string
  title: string
  markdown: string
  siteName?: string
  author?: string
  description?: string
  publishedAt?: string
  canonicalUrl?: string
  contentHash: string
  wordCount: number
  tokenCount: number
  extractionMethod: ExtractionMethod
}

const RSS_MIN_WORDS = 40

async function extractItemContent(item: FeedItemEntity): Promise<ExtractedData | null> {
  const meta = { title: item.title, author: item.author, publishedAt: item.publishedAt }

  // 1. RSS full body via offscreen
  if (item.contentHtml) {
    console.log('[bg] extract: trying RSS body for', item.link, `(${item.contentHtml.length} chars)`)
    const res = await sendToOffscreen<{ ok: boolean; data?: any; error?: string }>({
      type: 'EXTRACT_HTML',
      html: item.contentHtml,
      url: item.link,
      meta,
    })
    if (res?.ok && res.data) {
      console.log('[bg] extract: RSS body ok, wordCount=', res.data.wordCount)
      if (res.data.wordCount >= RSS_MIN_WORDS) return res.data as ExtractedData
    } else {
      console.log('[bg] extract: RSS body failed or too short', res?.error ?? `wordCount=${res?.data?.wordCount}`)
    }
  } else {
    console.log('[bg] extract: no contentHtml for', item.link)
  }

  // 2. Fetch original article page and extract via offscreen
  if (item.link) {
    console.log('[bg] extract: fetching original page', item.link)
    try {
      const res = await fetchWithTimeout(item.link, { redirect: 'follow' })
      if (res.ok) {
        const html = await res.text()
        console.log('[bg] extract: fetched page ok, html length=', html.length)
        const extractRes = await sendToOffscreen<{ ok: boolean; data?: any; error?: string }>({
          type: 'EXTRACT_HTML',
          html,
          url: item.link,
          meta,
        })
        if (extractRes?.ok && extractRes.data) {
          console.log('[bg] extract: page extraction ok, wordCount=', extractRes.data.wordCount)
          if (extractRes.data.wordCount > 0) return extractRes.data as ExtractedData
        } else {
          console.log('[bg] extract: page extraction failed:', extractRes?.error ?? 'no data')
        }
      } else {
        console.log('[bg] extract: fetch failed, status=', res.status)
      }
    } catch (e) {
      console.warn('[bg] extract: fetch error:', e)
    }
  }

  // 3. Last resort: feed summary
  if (item.summary) {
    console.log('[bg] extract: trying summary, length=', item.summary.length)
    const res = await sendToOffscreen<{ ok: boolean; data?: any; error?: string }>({
      type: 'EXTRACT_HTML',
      html: item.summary,
      url: item.link,
      meta,
    })
    if (res?.ok && res.data && res.data.wordCount > 0) {
      console.log('[bg] extract: summary ok, wordCount=', res.data.wordCount)
      return res.data as ExtractedData
    } else {
      console.log('[bg] extract: summary failed:', res?.error ?? 'no data')
    }
  }

  console.warn('[bg] extract: all sources exhausted for', item.link)
  return null
}

// ---------------------------------------------------------------------------
// Background alarm setup
// ---------------------------------------------------------------------------

const FEED_ALARM = 'feed-refresh'
const FEED_INTERVAL_MINUTES = 30

export function setupFeedAlarm() {
  browser.alarms?.create(FEED_ALARM, { periodInMinutes: FEED_INTERVAL_MINUTES }).catch(() => {})
}

export async function onFeedAlarm() {
  console.log('[bg] feed refresh alarm fired')
  try {
    const results = await refreshAllFeeds()
    const totalNew = results.reduce((s: number, r) => s + r.newItems, 0)
    const totalCollected = results.reduce((s: number, r) => s + r.collected, 0)
    if (totalNew || totalCollected) {
      console.log(`[bg] feed refresh: ${totalNew} new items, ${totalCollected} collected`)
      // Notify panel if open
      browser.runtime
        .sendMessage({ type: 'FEEDS_REFRESHED', payload: { totalNew, totalCollected } })
        .catch(() => {})
    }
  } catch (e) {
    console.warn('[bg] feed refresh failed:', e)
  }
}
