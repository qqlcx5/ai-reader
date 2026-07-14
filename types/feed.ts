export interface FeedEntity {
  id: string

  url: string
  title: string
  siteUrl?: string
  description?: string

  /** Grouping (folder). Free-form string; UI aggregates by it. */
  folder?: string

  /** When true, new items are auto-collected into the library on refresh
   *  (fetch article → defuddle → DocumentEntity). Opt-in per feed, intended
   *  for low-volume curated feeds. */
  autoCollect?: boolean

  /** Minimum word count for auto-collected articles. Items below this are
   *  skipped to avoid shelving truncated/teaser content. Default 200.
   *  Manual collects are exempt. */
  autoCollectMinWords?: number

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
  /** Set when the most recent collect attempt failed and exhausted all retries.
   *  Items with this flag are skipped by the periodic alarm-driven collect, but
   *  the user can clear it (e.g. by clicking the panel "collect" button) to
   *  give the item another shot. */
  collectError?: string
  collectErrorAt?: string
}
