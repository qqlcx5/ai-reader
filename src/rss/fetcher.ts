/**
 * M8 RSS Pipeline — Fetcher
 *
 * Fetches and parses RSS/Atom/JSON Feed XML documents.
 * Supports RSS 2.0, Atom, and JSON Feed formats.
 *
 * Based on design-08-rss-pipeline.md §5.
 */

import type { RssFeed, RssItem } from './types';
import { computeItemHash, deduplicateItems, storeItemHashes } from './dedup';
import { summarizeNewItems } from './summarizer';
import { saveRssItems, updateFeedLastFetched } from './feed-store';
import { updateBadge } from './badge';

// ─── Types ────────────────────────────────────────────────────────────

interface ParsedFeed {
  title: string;
  items: Omit<RssItem, 'id' | 'hash' | 'isRead' | 'isSummarized' | 'createdAt' | 'feedId'>[];
}

// ─── Public API ──────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 30000;
const USER_AGENT = 'ai-reader/1.0 RSS Reader';

/**
 * Fetch and process a single RSS feed.
 *
 * Steps:
 * 1. Fetch the feed URL
 * 2. Parse XML/JSON
 * 3. Deduplicate against stored items
 * 4. Store new items
 * 5. Trigger AI summarization (if enabled)
 * 6. Update badge
 */
export async function processFeed(feed: RssFeed): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(feed.url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    const parsed = parseFeedContent(text, feed.url);

    // Update feed title if needed
    if (parsed.title && parsed.title !== feed.title) {
      feed.title = parsed.title;
    }

    const now = Date.now();
    const newItems: RssItem[] = parsed.items.map((item) => ({
      ...item,
      id: `rss-item-${feed.id}-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      feedId: feed.id,
      hash: computeItemHash(feed.id, item.title, item.link),
      isRead: false,
      isSummarized: false,
      createdAt: now,
    }));

    // Deduplicate and save
    const uniqueItems = await deduplicateItems(newItems);

    if (uniqueItems.length > 0) {
      await saveRssItems(uniqueItems);
      // Persist item hashes for future dedup
      await storeItemHashes(uniqueItems.map((i) => i.hash));
      await summarizeNewItems(uniqueItems);
    }

    // Persist feed state
    await updateFeedLastFetched(feed.id, now);

    await updateBadge();
  } catch (err) {
    await updateFeedLastFetched(feed.id, feed.lastFetchedAt ?? Date.now(), {
      code: 'FETCH_ERROR',
      message: err instanceof Error ? err.message : String(err),
      at: Date.now(),
    });
  }
}

// ─── Parsing ──────────────────────────────────────────────────────────

function parseFeedContent(xml: string, feedUrl: string): ParsedFeed {
  // Try JSON Feed first (application/feed+json)
  if (xml.trim().startsWith('{')) {
    return parseJsonFeed(xml);
  }

  return parseXmlFeed(xml);
}

function parseJsonFeed(text: string): ParsedFeed {
  const doc = JSON.parse(text);
  const title = doc.title || '';
  const items = (doc.items || []).map((item: Record<string, unknown>) => ({
    title: String(item.title || 'Untitled'),
    link: String(item.url || item.external_url || ''),
    pubDate: parseDate(String(item.date_published || item.date_modified || Date.now())),
    content: String(item.content_html || item.content_text || item.summary || ''),
  }));
  return { title, items };
}

function parseXmlFeed(xml: string): ParsedFeed {
  // Minimal XML parsing without external dependencies
  // Supports RSS 2.0 and Atom

  const title = extractTag(xml, 'title');
  const isAtom = xml.includes('xmlns="http://www.w3.org/2005/Atom"') || xml.includes('<feed');

  const items: ParsedFeed['items'] = [];

  if (isAtom) {
    // Atom: <entry> elements
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      items.push({
        title: extractTag(entryXml, 'title'),
        link: extractLinkHref(entryXml) || extractTag(entryXml, 'link'),
        pubDate: parseDate(extractTag(entryXml, 'published') || extractTag(entryXml, 'updated') || ''),
        content: extractTag(entryXml, 'content') || extractTag(entryXml, 'summary') || '',
      });
    }
  } else {
    // RSS 2.0: <item> elements
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      items.push({
        title: extractTag(itemXml, 'title'),
        link: extractTag(itemXml, 'link'),
        pubDate: parseDate(extractTag(itemXml, 'pubDate') || ''),
        content: extractTag(itemXml, 'content:encoded') || extractTag(itemXml, 'description') || '',
      });
    }
  }

  return { title, items };
}

// ─── XML Helpers ──────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`, 'i');
  const cdataMatch = regex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  const plainRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const plainMatch = plainRegex.exec(xml);
  if (plainMatch) return decodeHtmlEntities(plainMatch[1].trim());

  return '';
}

function extractLinkHref(xml: string): string {
  const regex = /<link[^>]*href="([^"]*)"[^>]*\/?>/i;
  const match = regex.exec(xml);
  return match ? match[1] : '';
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function parseDate(dateStr: string): number {
  if (!dateStr) return Date.now();
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? Date.now() : parsed;
}
