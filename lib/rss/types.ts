/**
 * M8 — RSS Pipeline types.
 *
 * Runtime types used by the RSS scheduler, fetcher, dedup, summarizer,
 * and badge modules. The on-disk representation is the M7
 * `RssFeedRecord` / `RssItemRecord`; this module reuses those field
 * names for consistency.
 */
import type { RssFeedRecord, RssItemRecord } from '@/modules/storage/types';

// Re-export for convenience — consumers import from here.
export type { RssFeedRecord, RssItemRecord };

/** A parsed feed entry before any storage mapping. */
export interface ParsedItem {
  title: string;
  link: string;
  pubDate: Date;
  content: string;
}

/** Result of a single feed fetch + parse cycle. */
export interface FetchResult {
  feed: RssFeedRecord;
  items: ParsedItem[];
  error?: { code: string; message: string };
}

/** Hash parameters used for dedup computation. */
export interface DedupInput {
  feedId: string;
  title: string;
  link: string;
}

/** Options controlling the AI summarization step. */
export interface SummarizerOptions {
  enabled: boolean;
  providerId: string;
  timeoutMs?: number;
}

/** A single pending summary request. */
export interface SummaryJob {
  itemId: string;
  title: string;
  content: string;
}

/** Statistics for the badge update. */
export interface BadgeStats {
  unreadCount: number;
}
