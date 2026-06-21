/**
 * M8 — RSS pipeline orchestrator.
 *
 * Coordinates the full fetch → dedup → summarize → store flow for a
 * single feed. Called by the background service worker when a
 * `rss:<feedId>` alarm fires.
 */
import { getDb } from '@/modules/storage/db';
import type { RssFeedRecord, RssItemRecord } from '@/modules/storage/types';
import { fetchFeed } from './fetcher';
import { computeItemHash, filterNewItems } from './dedup';
import { summarizeBatch } from './summarizer';
import { updateBadge } from './badge';
import type { SummaryJob, SummarizerOptions } from './types';

/**
 * Run the full pipeline for a single feed.
 *
 * 1. Fetch and parse the feed XML/JSON.
 * 2. Query existing hashes for dedup.
 * 3. Filter out already-stored items.
 * 4. Optionally summarize new items (if rssConfig.aiSummaryEnabled).
 * 5. Write new items to Dexie.
 * 6. Update the feed's `lastFetchedAt` and clear `lastError`.
 * 7. Refresh the badge.
 *
 * Returns a summary of what happened.
 */
export async function runFeedPipeline(
  feed: RssFeedRecord,
  summarizerOptions: SummarizerOptions,
): Promise<PipelineResult> {
  const db = getDb();
  const now = Date.now();

  // 1. Fetch
  const result = await fetchFeed(feed);
  if (result.error || result.items.length === 0) {
    await updateFeedError(feed.id, result.error, now);
    return { feedId: feed.id, newItems: 0, summarized: 0, error: result.error };
  }

  // 2. Dedup
  const existingHashes = await collectExistingHashes(db, feed.id);
  const newItems = filterNewItems(
    result.items.map((item) => ({
      feedId: feed.id,
      title: item.title,
      link: item.link,
    })),
    existingHashes,
  );

  if (newItems.length === 0) {
    await updateFeedSuccess(feed.id, now);
    return { feedId: feed.id, newItems: 0, summarized: 0 };
  }

  // 3. Map to storage records
  const records: RssItemRecord[] = newItems.map((item, i) => {
    const parsed = result.items.find(
      (p) => computeItemHash({ feedId: feed.id, title: item.title, link: item.link }) === computeItemHash(item),
    );
    return {
      id: `rss-${feed.id}-${now}-${i}`,
      feedId: feed.id,
      title: item.title,
      link: item.link,
      pubDate: parsed?.pubDate.getTime() ?? now,
      content: parsed?.content,
      hash: computeItemHash(item),
      isRead: false,
      isSummarized: false,
    };
  });

  // 4. Optionally summarize
  let summarizedCount = 0;
  if (summarizerOptions.enabled) {
    const jobs: SummaryJob[] = records.map((r) => ({
      itemId: r.id,
      title: r.title || '',
      content: r.content || '',
    }));
    const summaries = await summarizeBatch(jobs, summarizerOptions);
    for (const record of records) {
      const summary = summaries.get(record.id);
      if (summary) {
        record.aiSummary = summary;
        record.isSummarized = true;
        summarizedCount++;
      }
    }
  }

  // 5. Write to Dexie (bulkPut for upsert semantics)
  await db.rssItems.bulkPut(records);

  // 6. Update feed metadata
  await updateFeedSuccess(feed.id, now);

  // 7. Refresh badge
  await updateBadge();

  return {
    feedId: feed.id,
    newItems: records.length,
    summarized: summarizedCount,
  };
}

export interface PipelineResult {
  feedId: string;
  newItems: number;
  summarized: number;
  error?: { code: string; message: string };
}

// ─── Internal helpers ────────────────────────────────────────────────

async function collectExistingHashes(
  db: ReturnType<typeof getDb>,
  feedId: string,
): Promise<Set<string>> {
  const items = await db.rssItems.where('feedId').equals(feedId).toArray();
  return new Set(items.map((i) => i.hash));
}

async function updateFeedSuccess(
  feedId: string,
  now: number,
): Promise<void> {
  const db = getDb();
  await db.rssFeeds.update(feedId, {
    lastFetchedAt: now,
    lastError: undefined,
  });
}

async function updateFeedError(
  feedId: string,
  error: { code: string; message: string } | undefined,
  now: number,
): Promise<void> {
  const db = getDb();
  await db.rssFeeds.update(feedId, {
    lastFetchedAt: now,
    lastError: error ? { ...error, at: now } : undefined,
  });
}
