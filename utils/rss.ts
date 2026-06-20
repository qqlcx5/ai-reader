// RSS types and parsing utilities

export type RSSCategory = 'tech' | 'ai' | 'product' | 'science' | 'business' | 'design' | 'news' | 'custom';

export const RSS_CATEGORY_META: Record<RSSCategory, { label: string; color: string; icon?: string }> = {
  tech: { label: 'Tech', color: '#3b82f6' },
  ai: { label: 'AI', color: '#8b5cf6' },
  product: { label: 'Product', color: '#22c55e' },
  science: { label: 'Science', color: '#f97316' },
  business: { label: 'Business', color: '#eab308' },
  design: { label: 'Design', color: '#ec4899' },
  news: { label: 'News', color: '#6b7280' },
  custom: { label: 'Custom', color: '#9ca3af' },
};

export interface RSSFeedConfig {
  id: string;
  url: string; // RSS/Atom feed URL
  name: string; // Display name, auto-derived from feed if empty
  enabled: boolean;
  category: RSSCategory; // NEW
  tags: string[]; // NEW 用户可打的自定义标签
  lastFetchedAt: number;
  lastFetchedError?: string; // NEW feed 健康状态错误信息
  lastItemGuid: string; // GUID of the last seen item (for dedup)
  fetchIntervalMinutes: number; // NEW 默认 30，可单独配置
  maxItemsPerFetch: number; // NEW 默认 3，可单独配置
  autoName: boolean; // NEW 是否自动从 feed title 命名
}

export interface RSSDigestItem {
  id: string; // `${feedId}:${guid}`
  feedId: string;
  feedName: string;
  category: RSSCategory; // NEW 继承 feed 分类
  tags: string[]; // NEW 继承 feed 标签
  title: string;
  url: string; // Original article URL
  publishedAt: number; // Publication timestamp
  fetchedAt: number;
  summary: string; // AI-generated summary
  isRead: boolean;
  summarizing: boolean; // true while waiting for AI
  summaryError: string;
  starred: boolean; // NEW 收藏
  laterRead: boolean; // NEW 稍后读
  aiTags: string[]; // NEW AI 生成的标签（摘要后提取 1-3 个关键词）
  matchedKeywords: string[]; // NEW 匹配到的关键词（用于过滤反馈）
}

export interface RSSFilterSettings {
  // 白名单：标题或摘要中必须包含至少一个关键词；为空则不限制
  whitelistKeywords: string[];
  // 黑名单：标题或摘要中只要包含任一关键词即隐藏
  blacklistKeywords: string[];
  // 匹配范围
  matchInTitle: boolean;
  matchInSummary: boolean;
  // 分类筛选：为空数组表示全部
  selectedCategories: RSSCategory[];
  // 时间范围过滤（小时数），0 表示全部
  maxAgeHours: number;
  // 只显示未读
  onlyUnread: boolean;
  // 只显示收藏
  onlyStarred: boolean;
  // 只显示稍后读
  onlyLaterRead: boolean;
}

export interface RSSGlobalSettings {
  fetchIntervalMinutes: number; // 全局默认，默认 30
  summaryMaxChars: number; // 摘要最大字符，默认 500
  summaryPrompt: string; // 自定义摘要 prompt
  autoExtractTags: boolean; // 是否在摘要后自动提取标签
  tagExtractPrompt: string; // 自动提取标签的 prompt
  badgeMode: 'unread' | 'all' | 'starred'; // badge 计数模式
  defaultMaxItemsPerFeed: number; // 默认每 feed 最大新条目数，默认 3
  enableNotifications: boolean; // 新摘要完成是否显示浏览器通知
  dedupeByTitle: boolean; // 是否按标题去重（跨 feed）
}

export interface ParsedRSSItem {
  title: string;
  link: string;
  guid: string;
  pubDate: number;
  description: string;
}

export interface ParsedRSSFeed {
  title: string;
  items: ParsedRSSItem[];
}

// --- RSS XML Parsing ---

function getText(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  // Extract CDATA content if present
  const cdataMatch = match[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdataMatch) return cdataMatch[1].trim();
  return match[1].trim();
}

function getAttr(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["']`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function parseDate(dateStr: string): number {
  if (!dateStr) return Date.now();
  const ts = Date.parse(dateStr);
  return isNaN(ts) ? Date.now() : ts;
}

/**
 * Parse RSS XML string (supports both RSS 2.0 and Atom feeds).
 * Uses DOMParser when available, falls back to regex-based parsing.
 */
export function parseRSS(xml: string): ParsedRSSFeed {
  // Try DOMParser first (available in most browser contexts including service workers)
  if (typeof DOMParser !== 'undefined') {
    try {
      const result = parseWithDOMParser(xml);
      // If DOMParser returned items with empty titles, try regex (CDATA issues)
      if (result.items.length > 0 && result.items.every((i) => i.title || i.link)) {
        return result;
      }
      // Fall through to regex if DOMParser had issues
    } catch {
      // Fall through to regex parser
    }
  }
  return parseWithRegex(xml);
}

function parseWithDOMParser(xml: string): ParsedRSSFeed {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  // Check for RSS 2.0
  const channelTitle = doc.querySelector('channel > title')?.textContent || '';
  const rssItems = doc.querySelectorAll('item');
  if (rssItems.length > 0) {
    return {
      title: channelTitle,
      items: Array.from(rssItems).map((item) => ({
        title: item.querySelector('title')?.textContent?.trim() || '',
        link: item.querySelector('link')?.textContent?.trim() || '',
        guid: item.querySelector('guid')?.textContent?.trim() || item.querySelector('link')?.textContent?.trim() || '',
        pubDate: parseDate(item.querySelector('pubDate')?.textContent?.trim() || ''),
        description: stripHtml(item.querySelector('description')?.textContent?.trim() || ''),
      })),
    };
  }

  // Check for Atom
  const feedTitle = doc.querySelector('feed > title')?.textContent || '';
  const entries = doc.querySelectorAll('entry');
  if (entries.length > 0) {
    return {
      title: feedTitle,
      items: Array.from(entries).map((entry) => ({
        title: entry.querySelector('title')?.textContent?.trim() || '',
        link: entry.querySelector('link')?.getAttribute('href')?.trim() || '',
        guid: entry.querySelector('id')?.textContent?.trim() || entry.querySelector('link')?.getAttribute('href')?.trim() || '',
        pubDate: parseDate(entry.querySelector('updated')?.textContent?.trim() || entry.querySelector('published')?.textContent?.trim() || ''),
        description: stripHtml(entry.querySelector('content')?.textContent?.trim() || entry.querySelector('summary')?.textContent?.trim() || ''),
      })),
    };
  }

  return { title: '', items: [] };
}

function parseWithRegex(xml: string): ParsedRSSFeed {
  // RSS 2.0
  const channelTitle = getText(xml, 'title');
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const items: ParsedRSSItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = getText(itemXml, 'title');
    const link = getText(itemXml, 'link') || getAttr(itemXml, 'link', 'href');
    const guid = getText(itemXml, 'guid') || link;
    const pubDate = parseDate(getText(itemXml, 'pubDate'));
    const description = stripHtml(getText(itemXml, 'description') || getText(itemXml, 'content:encoded'));
    items.push({ title, link, guid, pubDate, description });
  }

  if (items.length > 0) {
    return { title: channelTitle, items };
  }

  // Atom
  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];
    const title = getText(entryXml, 'title');
    const link = getText(entryXml, 'link') || getAttr(entryXml, 'link', 'href');
    const guid = getText(entryXml, 'id') || link;
    const pubDate = parseDate(getText(entryXml, 'updated') || getText(entryXml, 'published'));
    const description = stripHtml(getText(entryXml, 'content') || getText(entryXml, 'summary'));
    items.push({ title, link, guid, pubDate, description });
  }

  return { title: channelTitle, items };
}

/**
 * Generate a unique ID for a feed config.
 */
export function generateFeedId(): string {
  return `feed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a digest item ID from feed ID and guid.
 */
export function generateDigestId(feedId: string, guid: string): string {
  return `${feedId}:${guid}`;
}

/**
 * Default feeds pre-populated on first load.
 */
export const DEFAULT_FEEDS: Array<Omit<RSSFeedConfig, 'id'>> = [
  { url: 'https://hnrss.org/best', name: 'Hacker News Best', category: 'tech', tags: ['hacker-news'], enabled: true, fetchIntervalMinutes: 30, maxItemsPerFetch: 3, autoName: true, lastFetchedAt: 0, lastItemGuid: '' },
  { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge', category: 'tech', tags: ['tech-news'], enabled: true, fetchIntervalMinutes: 30, maxItemsPerFetch: 3, autoName: true, lastFetchedAt: 0, lastItemGuid: '' },
  { url: 'https://techcrunch.com/feed/', name: 'TechCrunch', category: 'tech', tags: ['startup'], enabled: true, fetchIntervalMinutes: 30, maxItemsPerFetch: 3, autoName: true, lastFetchedAt: 0, lastItemGuid: '' },
  { url: 'https://www.producthunt.com/feed', name: 'Product Hunt', category: 'product', tags: ['product'], enabled: true, fetchIntervalMinutes: 60, maxItemsPerFetch: 5, autoName: true, lastFetchedAt: 0, lastItemGuid: '' },
  { url: 'https://www.ainews.com/feed', name: 'AI News', category: 'ai', tags: ['ai'], enabled: true, fetchIntervalMinutes: 30, maxItemsPerFetch: 3, autoName: true, lastFetchedAt: 0, lastItemGuid: '' },
  { url: 'https://www.science.org/rss/news_current.xml', name: 'Science News', category: 'science', tags: ['science'], enabled: true, fetchIntervalMinutes: 60, maxItemsPerFetch: 3, autoName: true, lastFetchedAt: 0, lastItemGuid: '' },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', name: 'BBC Tech', category: 'news', tags: ['bbc'], enabled: true, fetchIntervalMinutes: 30, maxItemsPerFetch: 3, autoName: true, lastFetchedAt: 0, lastItemGuid: '' },
  { url: 'https://www.smashingmagazine.com/feed/', name: 'Smashing Magazine', category: 'design', tags: ['design'], enabled: true, fetchIntervalMinutes: 120, maxItemsPerFetch: 3, autoName: true, lastFetchedAt: 0, lastItemGuid: '' },
  { url: 'https://www.reuters.com/technology/rssfeed/', name: 'Reuters Tech', category: 'business', tags: ['business'], enabled: true, fetchIntervalMinutes: 30, maxItemsPerFetch: 3, autoName: true, lastFetchedAt: 0, lastItemGuid: '' },
  { url: 'https://news.ycombinator.com/rss', name: 'Hacker News Top', category: 'tech', tags: ['hacker-news'], enabled: false, fetchIntervalMinutes: 30, maxItemsPerFetch: 3, autoName: true, lastFetchedAt: 0, lastItemGuid: '' },
];

/**
 * Default global RSS settings.
 */
export const DEFAULT_GLOBAL_SETTINGS: RSSGlobalSettings = {
  fetchIntervalMinutes: 30,
  summaryMaxChars: 500,
  summaryPrompt: '请用3个要点总结以下文章的核心内容，每点不超过50字：\n\n标题：{title}\n\n{content}',
  autoExtractTags: true,
  tagExtractPrompt: '从以下文章摘要中提取 1-3 个关键词，用逗号分隔，只返回关键词列表：\n\n{summary}',
  badgeMode: 'unread',
  defaultMaxItemsPerFeed: 3,
  enableNotifications: false,
  dedupeByTitle: true,
};

/**
 * Default filter settings.
 */
export const DEFAULT_FILTER_SETTINGS: RSSFilterSettings = {
  whitelistKeywords: [],
  blacklistKeywords: [],
  matchInTitle: true,
  matchInSummary: true,
  selectedCategories: [],
  maxAgeHours: 0,
  onlyUnread: false,
  onlyStarred: false,
  onlyLaterRead: false,
};

/**
 * Truncate text to a maximum number of characters.
 */
export function truncateText(text: string, maxChars: number): string {
  if (!text || text.length <= maxChars) return text || '';
  return text.slice(0, maxChars) + '...';
}

/**
 * Normalize a string for deduplication/title matching.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

/**
 * Check if two titles are similar enough for deduplication.
 */
export function titlesSimilar(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * Build a summary prompt from the global settings template.
 */
export function buildSummaryPrompt(settings: RSSGlobalSettings, title: string, content: string): string {
  return settings.summaryPrompt
    .replace(/\{title\}/g, title)
    .replace(/\{content\}/g, content);
}

/**
 * Build a tag extraction prompt from the global settings template.
 */
export function buildTagExtractPrompt(settings: RSSGlobalSettings, summary: string): string {
  return settings.tagExtractPrompt.replace(/\{summary\}/g, summary);
}

/**
 * Extract tags from a tag extraction response string.
 */
export function parseTagResponse(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[,，、\n]+/)
    .map((t) => t.trim().replace(/^#+/, '').replace(/[\s#]+/g, ''))
    .filter(Boolean)
    .slice(0, 3);
}

/**
 * Export feeds to OPML format.
 */
export function exportOPML(feeds: RSSFeedConfig[]): string {
  const outlines = feeds
    .map((f) => {
      const category = f.category !== 'custom' ? ` category="${escapeXml(f.category)}"` : '';
      const tags = f.tags.length > 0 ? ` tags="${escapeXml(f.tags.join(','))}"` : '';
      return `    <outline type="rss" text="${escapeXml(f.name)}" xmlUrl="${escapeXml(f.url)}"${category}${tags} />`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>AI Reader RSS Feeds</title>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
}

/**
 * Import feeds from OPML text.
 */
export function importOPML(opmlText: string): Array<Pick<RSSFeedConfig, 'url' | 'name' | 'category' | 'tags'>> {
  const feeds: Array<Pick<RSSFeedConfig, 'url' | 'name' | 'category' | 'tags'>> = [];
  const regex = /<outline[^>]*type=["']rss["'][^>]*\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(opmlText)) !== null) {
    const xml = match[0];
    const url = getAttrOPML(xml, 'xmlurl') || getAttrOPML(xml, 'url') || getAttrOPML(xml, 'htmlurl');
    const name = getAttrOPML(xml, 'text') || getAttrOPML(xml, 'title') || url;
    const category = (getAttrOPML(xml, 'category') || 'custom') as RSSCategory;
    const tagsText = getAttrOPML(xml, 'tags');
    const tags = tagsText ? tagsText.split(',').map((t) => t.trim()).filter(Boolean) : [];
    if (url) feeds.push({ url, name, category, tags });
  }
  return feeds;
}

function getAttrOPML(xml: string, attr: string): string {
  const regex = new RegExp(`${attr}=["']([^"']*)["']`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Migrate legacy feeds to include new required fields.
 */
export function migrateFeed(feed: Partial<RSSFeedConfig> & Pick<RSSFeedConfig, 'id' | 'url'>): RSSFeedConfig {
  return {
    id: feed.id,
    url: feed.url,
    name: feed.name || feed.url,
    enabled: feed.enabled ?? true,
    category: feed.category || 'custom',
    tags: feed.tags ?? [],
    lastFetchedAt: feed.lastFetchedAt || 0,
    lastFetchedError: feed.lastFetchedError,
    lastItemGuid: feed.lastItemGuid || '',
    fetchIntervalMinutes: feed.fetchIntervalMinutes ?? 30,
    maxItemsPerFetch: feed.maxItemsPerFetch ?? 3,
    autoName: feed.autoName ?? false,
  };
}

/**
 * Apply keyword filtering to a list of digests, returning matched digests with matchedKeywords populated.
 */
export function applyKeywordFilter(
  digests: RSSDigestItem[],
  filter: RSSFilterSettings
): RSSDigestItem[] {
  return digests.map((d) => ({ ...d, matchedKeywords: [] })).map((d) => {
    const textParts: string[] = [];
    if (filter.matchInTitle) textParts.push(d.title);
    if (filter.matchInSummary) textParts.push(d.summary);
    const haystack = textParts.join(' ').toLowerCase();

    const matchedKeywords: string[] = [];

    // Blacklist
    for (const kw of filter.blacklistKeywords) {
      if (!kw) continue;
      if (haystack.includes(kw.toLowerCase())) {
        return null;
      }
    }

    // Whitelist
    if (filter.whitelistKeywords.length > 0) {
      let anyMatch = false;
      for (const kw of filter.whitelistKeywords) {
        if (!kw) continue;
        if (haystack.includes(kw.toLowerCase())) {
          matchedKeywords.push(kw);
          anyMatch = true;
        }
      }
      if (!anyMatch) return null;
    }

    return { ...d, matchedKeywords };
  }).filter((d): d is RSSDigestItem => d !== null);
}
