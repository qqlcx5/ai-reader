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

  capturedAt: string
  updatedAt: string
  lastOpenedAt?: string

  tags?: string[]

  syncStatus?: 'local-only' | 'synced' | 'pending' | 'conflict'
}
