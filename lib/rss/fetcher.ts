/**
 * M8 — RSS fetcher & parser.
 *
 * Fetches an RSS/Atom/JSON Feed URL and parses it into `ParsedItem[]`.
 * No external dependencies — uses DOMParser for XML feeds and
 * JSON.parse for JSON Feed. Timeout defaults to 30s.
 */
import type { ParsedItem, FetchResult } from './types';
import type { RssFeedRecord } from './types';

const FETCH_TIMEOUT_MS = 30_000;
const MAX_ITEMS_PER_FETCH = 200;

/**
 * Fetch and parse a single RSS feed.
 *
 * Supports:
 *   - RSS 2.0 (`<rss><channel><item>`)
 *   - Atom (`<feed><entry>`)
 *   - JSON Feed (application/feed+json / .json)
 */
export async function fetchFeed(feed: RssFeedRecord): Promise<FetchResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AI-Reader/1.0',
        Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/json, text/xml, */*',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();

    let items: ParsedItem[];

    if (isJsonFeed(contentType, text)) {
      items = parseJsonFeed(text);
    } else {
      items = parseXmlFeed(text);
    }

    // Trim to a reasonable limit.
    items = items.slice(0, MAX_ITEMS_PER_FETCH);

    return { feed, items };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      feed,
      items: [],
      error: {
        code: err instanceof DOMException && err.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_ERROR',
        message,
      },
    };
  }
}

function isJsonFeed(contentType: string, text: string): boolean {
  if (contentType.includes('json') || contentType.includes('feed+json')) return true;
  // Heuristic: check if the body starts with `{`
  return text.trimStart().startsWith('{');
}

// ─── JSON Feed ──────────────────────────────────────────────────────────

interface JsonFeed {
  items: Array<{
    title?: string;
    url?: string;
    external_url?: string;
    link?: string;
    content_html?: string;
    content_text?: string;
    summary?: string;
    date_published?: string;
    date_modified?: string;
    published?: string;
  }>;
}

function parseJsonFeed(text: string): ParsedItem[] {
  const data = JSON.parse(text) as JsonFeed;
  return (data.items ?? []).map((item) => {
    const link = item.url || item.external_url || item.link || '';
    const content = item.content_html || item.content_text || item.summary || '';
    const dateStr = item.date_published || item.date_modified || item.published || '';
    return {
      title: item.title || 'Untitled',
      link,
      pubDate: dateStr ? new Date(dateStr) : new Date(),
      content,
    };
  });
}

// ─── XML Feed (RSS 2.0 / Atom) ─────────────────────────────────────────

function parseXmlFeed(text: string): ParsedItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');

  // Check for parse errors — jsdom returns a <parsererror> element.
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    // DOMParser failed (common with namespace prefixes in jsdom).
    // Fall back to regex-based extraction.
    return parseWithRegex(text);
  }

  // Detect feed format.
  const rssRoot = doc.querySelector('rss');
  if (rssRoot) {
    return parseRss2(doc);
  }

  const atomRoot = doc.querySelector('feed');
  if (atomRoot) {
    return parseAtom(doc);
  }

  // Fallback: try RSS 2.0 (some feeds omit the <rss> wrapper).
  return parseRss2(doc);
}

/**
 * Regex-based XML parser fallback for environments where DOMParser
 * can't handle namespace prefixes (e.g. jsdom without XML support).
 * Handles RSS 2.0 and Atom feeds.
 */
function parseWithRegex(text: string): ParsedItem[] {
  // Try RSS 2.0 first: look for <item> blocks.
  const rssItems = extractBlocks(text, 'item');
  if (rssItems.length > 0) {
    return rssItems.map((block) => ({
      title: extractTag(block, 'title') || 'Untitled',
      link: extractTag(block, 'link') || extractTag(block, 'guid') || '',
      pubDate: parseDate(extractTag(block, 'pubDate')),
      content:
        extractTag(block, 'description') ||
        extractTag(block, 'content:encoded') ||
        '',
    }));
  }

  // Try Atom: look for <entry> blocks.
  const atomEntries = extractBlocks(text, 'entry');
  if (atomEntries.length > 0) {
    return atomEntries.map((block) => ({
      title: extractTag(block, 'title') || 'Untitled',
      link: extractHref(block) || '',
      pubDate: parseDate(
        extractTag(block, 'published') || extractTag(block, 'updated'),
      ),
      content:
        extractTag(block, 'content') || extractTag(block, 'summary') || '',
    }));
  }

  return [];
}

/** Extract the inner content of the first match for a tag name. */
function extractTag(xml: string, tagName: string): string {
  // Match <tag>...</tag> or <tag ...>...</tag> (greedy inner content).
  const regex = new RegExp(
    `<${tagName}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tagName}>`,
    'i',
  );
  const match = regex.exec(xml);
  return match ? match[1].trim() : '';
}

/** Extract top-level blocks (e.g. <item>, <entry>) from the XML. */
function extractBlocks(text: string, tag: string): string[] {
  const regex = new RegExp(
    `<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`,
    'gi',
  );
  return [...text.matchAll(regex)].map((m) => m[0]);
}

/** Extract the href attribute from the first <link> inside a block. */
function extractHref(block: string): string {
  const match = /<link[^>]+href=["']([^"']+)["']/i.exec(block);
  if (match) return match[1];
  // Some Atom feeds use <link>text</link> instead of href attribute.
  return extractTag(block, 'link');
}

function parseRss2(doc: Document): ParsedItem[] {
  const items = doc.querySelectorAll('channel > item');
  const results: ParsedItem[] = [];

  items.forEach((itemEl) => {
    const title = textContent(itemEl, 'title') || 'Untitled';
    const link = textContent(itemEl, 'link') || textContent(itemEl, 'guid') || '';
    const content =
      textContent(itemEl, 'description') ||
      '';
    const pubDate = textContent(itemEl, 'pubDate');

    results.push({
      title: title.trim(),
      link: link.trim(),
      pubDate: pubDate ? parseDate(pubDate) : new Date(),
      content,
    });
  });

  return results;
}

function parseAtom(doc: Document): ParsedItem[] {
  const entries = doc.querySelectorAll('feed > entry');
  const results: ParsedItem[] = [];

  entries.forEach((entryEl) => {
    const title = textContent(entryEl, 'title') || 'Untitled';
    const linkEl = entryEl.querySelector('link[href]');
    const link = linkEl?.getAttribute('href') || '';
    const content =
      textContent(entryEl, 'content') ||
      textContent(entryEl, 'summary') ||
      '';
    const published =
      textContent(entryEl, 'published') ||
      textContent(entryEl, 'updated') ||
      '';

    results.push({
      title: title.trim(),
      link,
      pubDate: published ? parseDate(published) : new Date(),
      content,
    });
  });

  return results;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function textContent(parent: Element, selector: string): string {
  const el = parent.querySelector(selector);
  return el?.textContent?.trim() ?? '';
}

function parseDate(str: string): Date {
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}
