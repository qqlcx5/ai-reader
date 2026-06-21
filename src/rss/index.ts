/**
 * M8 RSS Pipeline — Unified Export
 *
 * Provides RSS feed management, background polling scheduler,
 * XML/JSON Feed parsing, deduplication, AI summarization,
 * and badge update utilities.
 *
 * Based on design-08-rss-pipeline.md.
 */

// ─── Types ────────────────────────────────────────────────────────────

export type {
  RssFeed,
  RssItem,
  SummaryRequest,
  RssConfig,
} from './types';

export { DEFAULT_RSS_CONFIG } from './types';

// ─── Scheduler ────────────────────────────────────────────────────────

export {
  initScheduler,
  scheduleAllFeeds,
  rescheduleFeed,
  unscheduleFeed,
} from './scheduler';

// ─── Fetcher ──────────────────────────────────────────────────────────

export { processFeed } from './fetcher';

// ─── Deduplication ────────────────────────────────────────────────────

export {
  computeItemHash,
  deduplicateItems,
  storeItemHashes,
  isDuplicateHash,
} from './dedup';

// ─── Summarizer ───────────────────────────────────────────────────────

export {
  summarizeNewItems,
  summarizeSingleItem,
} from './summarizer';

// ─── Badge ────────────────────────────────────────────────────────────

export {
  updateBadge,
  clearBadge,
  showIdleBadge,
} from './badge';

// ─── Feed Store ───────────────────────────────────────────────────────

export {
  loadRssFeeds,
  saveRssFeed,
  deleteRssFeed,
  updateFeedLastFetched,
  loadRssConfig,
  saveRssConfig,
  saveRssItems,
  loadAllRssItems,
  loadItemsByFeed,
  loadUnreadItems,
  markItemRead,
  updateItemSummary,
  getUnreadCount,
} from './feed-store';
