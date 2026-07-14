export type ExtractionMethod = 'defuddle' | 'fallback' | 'manual' | 'rss'

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

export interface Highlight {
  id: string
  /** Start character offset in the raw markdown string. */
  startOffset: number
  /** End character offset (exclusive). */
  endOffset: number
  /** The highlighted text snippet (redundant for sync dedup and display). */
  text: string
  /** Optional user annotation. */
  note?: string
  color?: HighlightColor
  createdAt: string
  updatedAt: string
}

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

  extractionMethod: ExtractionMethod
  source: 'current-page' | 'library'

  /** When this document was collected from an RSS feed: 'auto' = auto-collected
   *  on refresh, 'manual' = user clicked 收藏. Absent for non-feed documents. */
  feedOrigin?: 'manual' | 'auto'

  capturedAt: string
  updatedAt: string
  lastOpenedAt?: string

  /** Reading progress 0–1 (0 = not started, 1 = finished). */
  readProgress?: number
  /** ISO timestamp of when the document was marked as fully read. */
  readAt?: string

  tags?: string[]

  /** User highlights/annotations on the markdown content. */
  highlights?: Highlight[]

  syncStatus?: 'local-only' | 'synced' | 'pending' | 'conflict'
}

export type LibrarySortKey = 'viewed' | 'captured' | 'updated' | 'title'

export type ReadStatus = 'unread' | 'reading' | 'read'

/** Derive read status from progress + lastOpenedAt. */
/** Derive read status. readAt takes priority; lastOpenedAt marks "reading". */
export function getReadStatus(doc: Pick<DocumentEntity, 'readAt' | 'lastOpenedAt'>): ReadStatus {
  if (doc.readAt) return 'read'
  if (doc.lastOpenedAt) return 'reading'
  return 'unread'
}
