/**
 * Persisted representation of a single captured web page.
 *
 * The shape is intentionally close to the spec in `doc/detail.md`
 * (id, title, url, author?, publishedAt?, favicon?, description?,
 * keywords?, markdownContent, rawHtml?, siteName?, image?,
 * wordCount?, language?, schemaOrgData?, createdAt, updatedAt).
 *
 * `rawHtml` is stored only when the caller opts in (it's large and
 * usually unnecessary after Markdown extraction). The Persistence
 * module compresses it with lz-string before writing.
 */

export interface CapturedDocument {
  id: string
  url: string
  title: string
  author?: string
  publishedAt?: string
  favicon?: string
  description?: string
  keywords?: string[]
  markdownContent: string
  rawHtml?: string
  siteName?: string
  image?: string
  wordCount?: number
  language?: string
  schemaOrgData?: unknown
  createdAt: number
  updatedAt: number
}

/**
 * Lightweight metadata for listings/search results. Avoids dragging
 * the (potentially large) `markdownContent` / `rawHtml` into memory.
 */
export interface DocumentMetadata {
  id: string
  url: string
  title: string
  description?: string
  author?: string
  publishedAt?: string
  siteName?: string
  favicon?: string
  image?: string
  wordCount?: number
  createdAt: number
  updatedAt: number
}
