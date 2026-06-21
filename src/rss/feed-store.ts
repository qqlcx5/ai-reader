/**
 * M8 RSS Pipeline — Feed Store
 *
 * Provides persistence for RssFeed and RssItem records using
 * chrome.storage.local (lightweight, shared across extension contexts).
 * Also handles RssConfig storage.
 *
 * Based on design-08-rss-pipeline.md §3.
 */

import type { RssFeed, RssItem, RssConfig } from './types';
import { DEFAULT_RSS_CONFIG } from './types';

// ─── Storage Keys ────────────────────────────────────────────────────

const FEEDS_KEY = 'rss-feeds';
const CONFIG_KEY = 'rss-config';
const ITEMS_PREFIX = 'rss-items:'; // Per-feed: `rss-items:<feedId>`
const ALL_ITEMS_KEY = 'rss-all-items';
const MAX_STORED_ITEMS = 500;

// ─── Feed CRUD ───────────────────────────────────────────────────────

export async function loadRssFeeds(): Promise<RssFeed[]> {
  try {
    const stored = (await chrome.storage.local.get(FEEDS_KEY))[FEEDS_KEY];
    if (Array.isArray(stored)) return stored as RssFeed[];
  } catch {
    // Ignore
  }
  return [];
}

export async function saveRssFeed(feed: RssFeed): Promise<void> {
  const feeds = await loadRssFeeds();
  const idx = feeds.findIndex((f) => f.id === feed.id);
  if (idx >= 0) {
    feeds[idx] = feed;
  } else {
    feeds.push(feed);
  }
  await chrome.storage.local.set({ [FEEDS_KEY]: feeds });
}

export async function deleteRssFeed(feedId: string): Promise<void> {
  let feeds = await loadRssFeeds();
  feeds = feeds.filter((f) => f.id !== feedId);
  await chrome.storage.local.set({ [FEEDS_KEY]: feeds });
}

export async function updateFeedLastFetched(
  feedId: string,
  at: number,
  error?: { code: string; message: string; at: number },
): Promise<void> {
  const feeds = await loadRssFeeds();
  const feed = feeds.find((f) => f.id === feedId);
  if (feed) {
    feed.lastFetchedAt = at;
    if (error) feed.lastError = error;
    else feed.lastError = undefined;
    await chrome.storage.local.set({ [FEEDS_KEY]: feeds });
  }
}

// ─── RssConfig ───────────────────────────────────────────────────────

export async function loadRssConfig(): Promise<RssConfig> {
  try {
    const stored = (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY];
    if (stored) return { ...DEFAULT_RSS_CONFIG, ...(stored as Partial<RssConfig>) };
  } catch {
    // Ignore
  }
  return { ...DEFAULT_RSS_CONFIG };
}

export async function saveRssConfig(config: RssConfig): Promise<void> {
  await chrome.storage.local.set({ [CONFIG_KEY]: config });
}

// ─── RssItem Storage ─────────────────────────────────────────────────

export async function saveRssItems(items: RssItem[]): Promise<void> {
  if (items.length === 0) return;

  // Store globally
  const existing = await loadAllRssItems();
  const combined = [...items, ...existing]
    // Deduplicate by hash
    .filter((item, idx, arr) => arr.findIndex((i) => i.hash === item.hash) === idx)
    // Cap at MAX
    .sort((a, b) => b.pubDate - a.pubDate)
    .slice(0, MAX_STORED_ITEMS);

  await chrome.storage.local.set({ [ALL_ITEMS_KEY]: combined });
}

export async function loadAllRssItems(): Promise<RssItem[]> {
  try {
    const stored = (await chrome.storage.local.get(ALL_ITEMS_KEY))[ALL_ITEMS_KEY];
    if (Array.isArray(stored)) return stored as RssItem[];
  } catch {
    // Ignore
  }
  return [];
}

export async function loadItemsByFeed(feedId: string): Promise<RssItem[]> {
  const all = await loadAllRssItems();
  return all.filter((i) => i.feedId === feedId).sort((a, b) => b.pubDate - a.pubDate);
}

export async function loadUnreadItems(): Promise<RssItem[]> {
  const all = await loadAllRssItems();
  return all.filter((i) => !i.isRead).sort((a, b) => b.pubDate - a.pubDate);
}

export async function markItemRead(itemId: string): Promise<void> {
  const all = await loadAllRssItems();
  const item = all.find((i) => i.id === itemId);
  if (item) {
    item.isRead = true;
    await chrome.storage.local.set({ [ALL_ITEMS_KEY]: all });
  }
}

export async function updateItemSummary(
  itemId: string,
  summary: string,
): Promise<void> {
  const all = await loadAllRssItems();
  const item = all.find((i) => i.id === itemId);
  if (item) {
    item.aiSummary = summary;
    item.isSummarized = true;
    await chrome.storage.local.set({ [ALL_ITEMS_KEY]: all });
  }
}

export async function getUnreadCount(): Promise<number> {
  const all = await loadAllRssItems();
  return all.filter((i) => !i.isRead).length;
}
