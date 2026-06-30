import { extractPage } from '@/utils/content/extract'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { FeedItemRepository } from '@/db/repositories/feed-item.repository'
import { addToIndex } from '@/services/search'
import type { FeedItemEntity } from '@/types/feed'
import type { DocumentEntity } from '@/types/document'

/**
 * Collect a feed item into the knowledge base: fetch the article page, extract
 * its content with the same defuddle pipeline used for web capture, persist it
 * as a DocumentEntity, and link the feed item to it (documentId). The resulting
 * document is then a first-class library item — searchable, collectable, synced.
 */
export async function collectFeedItem(item: FeedItemEntity): Promise<DocumentEntity> {
  if (!item.link) throw new Error('该条目没有原文链接')

  const res = await fetch(item.link, { redirect: 'follow' })
  if (!res.ok) throw new Error(`抓取原文失败：HTTP ${res.status}`)

  const html = await res.text()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const data = await extractPage(doc, item.link)

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
