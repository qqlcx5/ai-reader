import { extractPage, extractFromHtml } from '@/utils/content/extract'
import type { ExtractedPageData } from '@/utils/content/extract'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { FeedItemRepository } from '@/db/repositories/feed-item.repository'
import { addToIndex } from '@/services/search'
import { enqueueForDocument } from '@/services/ai-job/queue'
import type { FeedItemEntity } from '@/types/feed'
import type { DocumentEntity } from '@/types/document'

const AUTO_COLLECT_CAP = 10

/** Minimum body length (words) for the RSS body to be trusted as the full
 *  article. Below this it's likely a truncated teaser → fetch the real page. */
const RSS_MIN_WORDS = 40

/**
 * Collect a feed item into the knowledge base as a DocumentEntity, linked back
 * to the item via documentId. Content resolution prefers the body the feed
 * already carries (contentHtml → Markdown); only when that's missing or just a
 * teaser do we fetch the original page and extract with defuddle — re-fetching
 * is fragile (paywalls, bot-blocks, JS-rendered shells) and the feed body is
 * usually the reliable copy. The summary is a last resort so we never persist
 * an empty document.
 */
export async function collectFeedItem(
  item: FeedItemEntity,
  origin: 'manual' | 'auto' = 'manual',
): Promise<DocumentEntity> {
  const data = await extractItemContent(item)
  if (!data) throw new Error('无法获取该条目的正文')

  const now = new Date().toISOString()
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

  await DocumentRepository.save(entity)
  await FeedItemRepository.setDocument(item.id, entity.id, now)
  try {
    addToIndex(entity)
  } catch {
    // search index is best-effort
  }
  return entity
}

/** Resolve an item's article content. RSS body first (no network), then the
 *  fetched original page, then the feed summary. Returns null only when every
 *  source is empty/unavailable. */
async function extractItemContent(item: FeedItemEntity): Promise<ExtractedPageData | null> {
  const meta = { title: item.title, author: item.author, publishedAt: item.publishedAt }

  // 1. RSS full body (content:encoded / atom content).
  if (item.contentHtml) {
    const d = await extractFromHtml(item.contentHtml, item.link, meta)
    if (d.wordCount >= RSS_MIN_WORDS) return d
  }

  // 2. Fetch the original article and extract with defuddle.
  if (item.link) {
    try {
      const res = await fetch(item.link, { redirect: 'follow' })
      if (res.ok) {
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
        const d = await extractPage(doc, item.link)
        if (d.wordCount > 0) return d
      }
    } catch {
      // network / CORS / bot-block → fall through to the summary
    }
  }

  // 3. Last resort: the feed summary blurb.
  if (item.summary) {
    const d = await extractFromHtml(item.summary, item.link, meta)
    if (d.wordCount > 0) return d
  }

  return null
}

/**
 * Collect a batch of items sequentially, best-effort. Used by auto-collect:
 * skips already-collected items, caps at AUTO_COLLECT_CAP per run so a burst of
 * new items can't flood the network, and leaves failures as plain feed items.
 */
export async function collectItems(
  items: FeedItemEntity[],
  origin: 'manual' | 'auto',
): Promise<number> {
  let collected = 0
  for (const item of items) {
    if (item.documentId) continue
    if (collected >= AUTO_COLLECT_CAP) break
    try {
      const entity = await collectFeedItem(item, origin)
      collected++
      // Auto-collected docs feed the AI analysis pipeline (opt-in via settings).
      if (origin === 'auto') {
        try {
          await enqueueForDocument(entity.id)
        } catch {
          // queue is best-effort — don't fail the collect
        }
      }
    } catch {
      // leave as a plain feed item; user can collect manually later
    }
  }
  return collected
}

