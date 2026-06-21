/**
 * M8 RSS Pipeline — Types
 *
 * Core data types for RSS feed management, item storage,
 * and AI summarization.
 *
 * Based on design-08-rss-pipeline.md §3.
 */

// ─── RSS Feed ────────────────────────────────────────────────────────

export interface RssFeed {
  id: string;
  url: string;
  title: string;
  enabled: boolean;
  /** Polling interval in minutes (default 360 = 6 hours) */
  intervalMinutes: number;
  /** Unix timestamp of last successful fetch, or null */
  lastFetchedAt: number | null;
  /** Last error details */
  lastError?: { code: string; message: string; at: number };
  createdAt: number;
}

// ─── RSS Item ────────────────────────────────────────────────────────

export interface RssItem {
  id: string;
  feedId: string;
  title: string;
  link: string;
  pubDate: number;
  /** Content summary or full text */
  content?: string;
  /** Stable hash for deduplication */
  hash: string;
  /** AI-generated 3-sentence summary */
  aiSummary?: string;
  isRead: boolean;
  isSummarized: boolean;
  createdAt: number;
}

// ─── Summary Request ─────────────────────────────────────────────────

export interface SummaryRequest {
  itemId: string;
  title: string;
  content: string;
  providerId: string;
}

// ─── RSS Configuration ───────────────────────────────────────────────

export interface RssConfig {
  /** Whether AI summarization is enabled (default: false) */
  autoSummarize: boolean;
  /** Provider ID for summarization */
  summaryProviderId: string;
  /** Maximum feeds allowed */
  maxFeeds: number;
  /** Default polling interval in minutes */
  defaultIntervalMinutes: number;
  /** Badge unread count visibility */
  showBadge: boolean;
}

export const DEFAULT_RSS_CONFIG: RssConfig = {
  autoSummarize: false,
  summaryProviderId: '',
  maxFeeds: 50,
  defaultIntervalMinutes: 360,
  showBadge: true,
};
