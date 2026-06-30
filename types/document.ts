export interface DocumentEntity {
  id: string

  url: string
  canonicalUrl?: string

  title: string
  siteName?: string
  author?: string
  description?: string
  publishedAt?: string

  markdown: string
  rawHtml?: string
  rawHtmlCompressed?: boolean

  excerpt?: string
  wordCount: number
  tokenCount: number
  contentHash: string

  extractionMethod: 'defuddle' | 'fallback' | 'manual'
  source: 'current-page' | 'library'

  /** When this document was collected from an RSS feed: 'auto' = auto-collected
   *  on refresh, 'manual' = user clicked 收藏. Absent for non-feed documents. */
  feedOrigin?: 'manual' | 'auto'

  capturedAt: string
  updatedAt: string
  lastOpenedAt?: string

  tags?: string[]

  syncStatus?: 'local-only' | 'synced' | 'pending' | 'conflict'
}

export type LibrarySortKey = 'viewed' | 'captured' | 'updated' | 'title'
