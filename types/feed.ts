export interface FeedEntity {
  id: string

  url: string
  title: string
  siteUrl?: string
  description?: string

  /** Grouping (folder). Free-form string; UI aggregates by it. */
  folder?: string

  /** Conditional-fetch tokens, let periodic refresh skip unchanged feeds. */
  etag?: string
  lastModified?: string
  lastFetchedAt?: string
  lastError?: string

  createdAt: string
  updatedAt: string
}

export interface FeedItemEntity {
  id: string

  feedId: string
  /** Stable per-item id from the feed (guid / atom id). Dedupe key per feed. */
  guid: string

  title: string
  link: string
  author?: string
  summary?: string
  /** Full HTML body from the feed (content:encoded / atom content), if any. */
  contentHtml?: string
  publishedAt?: string
  fetchedAt: string

  /** Local-only state (feedItems are NOT synced). */
  readAt?: string
  /** Set once the item has been collected into the library as a DocumentEntity. */
  documentId?: string
  collectedAt?: string
}
