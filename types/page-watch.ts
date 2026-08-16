import type { Sm2State } from '@/utils/sm2'
import type { DocumentEntity } from './document'

/** A recorded content change of a watched page. */
export interface PageWatchChange {
  at: string
  hash: string
  /** Excerpt (first ~2KB markdown) of the PREVIOUS version, for diff view. */
  previousExcerpt?: string
}

export interface PageWatchEntity {
  id: string

  url: string
  title: string
  enabled: boolean

  /** Hash of the last seen content. Absent until the first check. */
  lastHash?: string
  /** Excerpt of the last seen markdown (for change diffs). */
  lastMarkdownExcerpt?: string
  lastError?: string
  lastCheckedAt?: string
  lastChangedAt?: string
  /** Change history, newest first, capped. */
  changes?: PageWatchChange[]

  createdAt: string
  updatedAt: string
}
