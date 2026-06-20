import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  parseRSS,
  generateDigestId,
  truncateText,
  normalizeTitle,
  titlesSimilar,
  exportOPML,
  importOPML,
  parseTagResponse,
  buildSummaryPrompt,
  buildTagExtractPrompt,
  migrateFeed,
  applyKeywordFilter,
  RSS_CATEGORY_META,
  DEFAULT_FEEDS,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_FILTER_SETTINGS,
  type RSSFeedConfig,
  type RSSDigestItem,
  type RSSFilterSettings,
} from '@/utils/rss';
import { useRSSStore } from '@/stores/rss';

// Mock browser storage
const mockStorage: Record<string, any> = {};

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[]) => {
          const keysArr = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, any> = {};
          for (const k of keysArr) {
            if (k in mockStorage) result[k] = mockStorage[k];
          }
          return result;
        }),
        set: vi.fn(async (data: Record<string, any>) => {
          Object.assign(mockStorage, data);
        }),
      },
    },
    runtime: {
      connect: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onConnect: { addListener: vi.fn() },
      getURL: vi.fn((path: string) => path),
    },
    tabs: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    },
    action: {
      setBadgeText: vi.fn().mockResolvedValue(undefined),
      setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      onClicked: { addListener: vi.fn() },
    },
    sidePanel: { open: vi.fn() },
    commands: { onCommand: { addListener: vi.fn() } },
    alarms: {
      create: vi.fn(),
      onAlarm: { addListener: vi.fn() },
    },
    notifications: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

// --- RSS XML Parsing Tests ---

describe('parseRSS — RSS 2.0', () => {
  const rss2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article 1</title>
      <link>https://example.com/1</link>
      <guid>guid-1</guid>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <description>&lt;p&gt;Summary of article 1&lt;/p&gt;</description>
    </item>
    <item>
      <title>Article 2</title>
      <link>https://example.com/2</link>
      <guid>guid-2</guid>
      <pubDate>Mon, 02 Jan 2024 12:00:00 GMT</pubDate>
      <description>Summary of article 2</description>
    </item>
  </channel>
</rss>`;

  it('should parse feed title', () => {
    const result = parseRSS(rss2Xml);
    expect(result.title).toBe('Test Feed');
  });

  it('should parse items with title, link, guid, pubDate', () => {
    const result = parseRSS(rss2Xml);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('Article 1');
    expect(result.items[0].link).toBe('https://example.com/1');
    expect(result.items[0].guid).toBe('guid-1');
    expect(result.items[0].pubDate).toBe(Date.parse('Mon, 01 Jan 2024 12:00:00 GMT'));
  });

  it('should strip HTML from description', () => {
    const result = parseRSS(rss2Xml);
    expect(result.items[0].description).toBe('Summary of article 1');
  });
});

describe('parseRSS — Atom', () => {
  const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Test Feed</title>
  <entry>
    <title>Atom Article 1</title>
    <link href="https://example.com/atom/1" />
    <id>atom-id-1</id>
    <updated>2024-01-01T12:00:00Z</updated>
    <content>Content of atom article 1</content>
  </entry>
  <entry>
    <title>Atom Article 2</title>
    <link href="https://example.com/atom/2" />
    <id>atom-id-2</id>
    <updated>2024-01-02T12:00:00Z</updated>
    <summary>Summary of atom article 2</summary>
  </entry>
</feed>`;

  it('should parse atom feed title', () => {
    const result = parseRSS(atomXml);
    expect(result.title).toBe('Atom Test Feed');
  });

  it('should parse atom entries', () => {
    const result = parseRSS(atomXml);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('Atom Article 1');
    expect(result.items[0].link).toBe('https://example.com/atom/1');
    expect(result.items[0].guid).toBe('atom-id-1');
  });

  it('should parse atom content or summary', () => {
    const result = parseRSS(atomXml);
    expect(result.items[0].description).toBe('Content of atom article 1');
    expect(result.items[1].description).toBe('Summary of atom article 2');
  });
});

describe('parseRSS — edge cases', () => {
  it('should return empty for invalid XML', () => {
    const result = parseRSS('not xml');
    expect(result.items).toHaveLength(0);
  });

  it('should handle CDATA sections', () => {
    const xml = `<rss version="2.0"><channel><title>Test</title>
      <item>
        <title><![CDATA[CDATA Title]]></title>
        <link>https://example.com/cdata</link>
        <guid>cdata-guid</guid>
        <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
        <description><![CDATA[<p>CDATA description</p>]]></description>
      </item>
    </channel></rss>`;
    const result = parseRSS(xml);
    expect(result.items[0].title).toBe('CDATA Title');
    expect(result.items[0].description).toBe('CDATA description');
  });
});

// --- Utility function tests ---

describe('generateDigestId', () => {
  it('should combine feedId and guid', () => {
    expect(generateDigestId('feed1', 'guid1')).toBe('feed1:guid1');
  });
});

describe('truncateText', () => {
  it('should return original text if under limit', () => {
    expect(truncateText('short', 100)).toBe('short');
  });

  it('should truncate with ellipsis', () => {
    expect(truncateText('a'.repeat(100), 50)).toBe('a'.repeat(50) + '...');
  });
});

describe('normalizeTitle and titlesSimilar', () => {
  it('should normalize punctuation and whitespace', () => {
    expect(normalizeTitle('Hello, World! 2024')).toBe('helloworld2024');
  });

  it('should consider similar titles equal', () => {
    expect(titlesSimilar('AI news today!', 'AI News Today')).toBe(true);
    expect(titlesSimilar('Different', 'Same')).toBe(false);
  });
});

describe('OPML import/export', () => {
  it('should export feeds as OPML', () => {
    const feeds: RSSFeedConfig[] = [
      {
        id: 'f1', url: 'https://a.com/rss', name: 'A Feed', enabled: true, category: 'tech', tags: ['a', 'b'],
        lastFetchedAt: 0, lastItemGuid: '', fetchIntervalMinutes: 30, maxItemsPerFetch: 3, autoName: false,
      },
      {
        id: 'f2', url: 'https://b.com/rss', name: 'B Feed', enabled: false, category: 'custom', tags: [],
        lastFetchedAt: 0, lastItemGuid: '', fetchIntervalMinutes: 60, maxItemsPerFetch: 5, autoName: true,
      },
    ];
    const opml = exportOPML(feeds);
    expect(opml).toContain('<opml');
    expect(opml).toContain('<outline');
    expect(opml).toContain('A Feed');
    expect(opml).toContain('https://a.com/rss');
    expect(opml).toContain('category="tech"');
    expect(opml).toContain('tags="a,b"');
  });

  it('should import feeds from OPML', () => {
    const opml = `<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline type="rss" text="Imported Feed" xmlUrl="https://imported.com/rss" category="ai" tags="ml" />
  </body>
</opml>`;
    const feeds = importOPML(opml);
    expect(feeds).toHaveLength(1);
    expect(feeds[0].name).toBe('Imported Feed');
    expect(feeds[0].url).toBe('https://imported.com/rss');
    expect(feeds[0].category).toBe('ai');
    expect(feeds[0].tags).toEqual(['ml']);
  });

  it('should handle OPML without category or tags', () => {
    const opml = `<opml><body><outline type="rss" text="Plain" xmlUrl="https://plain.com/rss" /></body></opml>`;
    const feeds = importOPML(opml);
    expect(feeds[0].category).toBe('custom');
    expect(feeds[0].tags).toEqual([]);
  });
});

describe('tag parsing and prompt builders', () => {
  it('should parse tag response', () => {
    expect(parseTagResponse('AI, 机器学习, 深度学习')).toEqual(['AI', '机器学习', '深度学习']);
  });

  it('should build summary prompt from template', () => {
    const prompt = buildSummaryPrompt(DEFAULT_GLOBAL_SETTINGS, 'My Title', 'My content');
    expect(prompt).toContain('My Title');
    expect(prompt).toContain('My content');
  });

  it('should build tag extract prompt', () => {
    const prompt = buildTagExtractPrompt(DEFAULT_GLOBAL_SETTINGS, 'Summary text');
    expect(prompt).toContain('Summary text');
  });
});

describe('migrateFeed', () => {
  it('should add missing fields to legacy feed', () => {
    const legacy = { id: 'old', url: 'https://old.com/rss', name: 'Old', enabled: true, lastFetchedAt: 0, lastItemGuid: '' };
    const migrated = migrateFeed(legacy as RSSFeedConfig);
    expect(migrated.category).toBe('custom');
    expect(migrated.tags).toEqual([]);
    expect(migrated.fetchIntervalMinutes).toBe(30);
    expect(migrated.maxItemsPerFetch).toBe(3);
    expect(migrated.autoName).toBe(false);
  });

  it('should preserve existing fields', () => {
    const feed: RSSFeedConfig = {
      id: 'new', url: 'https://new.com/rss', name: 'New', enabled: true, category: 'ai', tags: ['tag'],
      lastFetchedAt: 1000, lastItemGuid: 'g', fetchIntervalMinutes: 15, maxItemsPerFetch: 10, autoName: true,
    };
    const migrated = migrateFeed(feed);
    expect(migrated.category).toBe('ai');
    expect(migrated.fetchIntervalMinutes).toBe(15);
  });
});

describe('applyKeywordFilter', () => {
  const digests: RSSDigestItem[] = [
    createDigest('d1', 'AI breakthrough', 'New AI model released'),
    createDigest('d2', 'Sports news', 'Team wins championship'),
    createDigest('d3', 'Tech AI update', 'Startups using AI'),
  ];

  it('should filter by whitelist in title', () => {
    const filter: RSSFilterSettings = { ...DEFAULT_FILTER_SETTINGS, whitelistKeywords: ['AI'], matchInTitle: true, matchInSummary: false };
    const result = applyKeywordFilter(digests, filter);
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.id)).toEqual(['d1', 'd3']);
    expect(result[0].matchedKeywords).toContain('AI');
  });

  it('should filter by whitelist in summary', () => {
    const filter: RSSFilterSettings = { ...DEFAULT_FILTER_SETTINGS, whitelistKeywords: ['championship'], matchInTitle: false, matchInSummary: true };
    const result = applyKeywordFilter(digests, filter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('d2');
  });

  it('should exclude by blacklist', () => {
    const filter: RSSFilterSettings = { ...DEFAULT_FILTER_SETTINGS, blacklistKeywords: ['sports'], matchInTitle: true, matchInSummary: true };
    const result = applyKeywordFilter(digests, filter);
    expect(result.map((d) => d.id)).toEqual(['d1', 'd3']);
  });

  it('should combine whitelist and blacklist', () => {
    const filter: RSSFilterSettings = { ...DEFAULT_FILTER_SETTINGS, whitelistKeywords: ['AI'], blacklistKeywords: ['sports'], matchInTitle: true, matchInSummary: true };
    const result = applyKeywordFilter(digests, filter);
    expect(result.map((d) => d.id)).toEqual(['d1', 'd3']);
  });
});

function createDigest(id: string, title: string, summary: string): RSSDigestItem {
  return {
    id,
    feedId: 'f',
    feedName: 'Feed',
    category: 'tech',
    tags: [],
    title,
    url: 'https://example.com',
    publishedAt: Date.now(),
    fetchedAt: Date.now(),
    summary,
    isRead: false,
    summarizing: false,
    summaryError: '',
    starred: false,
    laterRead: false,
    aiTags: [],
    matchedKeywords: [],
  };
}

// --- Pinia Store Tests ---

describe('useRSSStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  });

  describe('load', () => {
    it('should populate default feeds on first load', async () => {
      const rss = useRSSStore();
      await rss.load();
      expect(rss.feeds.length).toBeGreaterThanOrEqual(10);
      expect(rss.feeds.some((f) => f.url === 'https://hnrss.org/best')).toBe(true);
      expect(rss.feeds.some((f) => f.url === 'https://www.theverge.com/rss/index.xml')).toBe(true);
      expect(rss.feeds.some((f) => f.category === 'ai')).toBe(true);
      expect(rss.feeds.some((f) => f.category === 'business')).toBe(true);
    });

    it('should load saved feeds from storage', async () => {
      mockStorage['ai-reader-rss-feeds'] = [
        { id: 'test1', url: 'https://test.com/rss', name: 'Test', enabled: true, lastFetchedAt: 0, lastItemGuid: '' },
      ];
      const rss = useRSSStore();
      await rss.load();
      expect(rss.feeds).toHaveLength(1);
      expect(rss.feeds[0].name).toBe('Test');
    });

    it('should migrate legacy feeds on load', async () => {
      mockStorage['ai-reader-rss-feeds'] = [
        { id: 'legacy', url: 'https://legacy.com/rss', name: 'Legacy', enabled: true, lastFetchedAt: 0, lastItemGuid: '' },
      ];
      const rss = useRSSStore();
      await rss.load();
      expect(rss.feeds[0].category).toBe('custom');
      expect(rss.feeds[0].tags).toEqual([]);
      expect(rss.feeds[0].fetchIntervalMinutes).toBe(30);
      expect(rss.feeds[0].maxItemsPerFetch).toBe(3);
      expect(rss.feeds[0].autoName).toBe(false);
    });

    it('should load saved digests from storage', async () => {
      mockStorage['ai-reader-rss-digests'] = [
        { id: 'test:1', feedId: 'test', feedName: 'Test', title: 'T1', url: 'https://test.com/1', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '' },
      ];
      const rss = useRSSStore();
      await rss.load();
      expect(rss.digests).toHaveLength(1);
      expect(rss.digests[0].title).toBe('T1');
    });

    it('should load global settings from storage', async () => {
      mockStorage['ai-reader-rss-settings'] = { fetchIntervalMinutes: 60, summaryMaxChars: 300 };
      const rss = useRSSStore();
      await rss.load();
      expect(rss.globalSettings.fetchIntervalMinutes).toBe(60);
      expect(rss.globalSettings.summaryMaxChars).toBe(300);
      expect(rss.globalSettings.badgeMode).toBe('unread');
    });

    it('should load filter settings from storage', async () => {
      mockStorage['ai-reader-rss-filter'] = { onlyUnread: true, selectedCategories: ['ai'] };
      const rss = useRSSStore();
      await rss.load();
      expect(rss.filter.onlyUnread).toBe(true);
      expect(rss.filter.selectedCategories).toEqual(['ai']);
    });
  });

  describe('default feeds', () => {
    it('should have at least 10 default feeds', () => {
      expect(DEFAULT_FEEDS.length).toBeGreaterThanOrEqual(10);
    });

    it('should cover at least 6 categories', () => {
      const cats = new Set(DEFAULT_FEEDS.map((f) => f.category));
      expect(cats.size).toBeGreaterThanOrEqual(6);
    });
  });

  describe('addFeed', () => {
    it('should add a new feed', async () => {
      const rss = useRSSStore();
      await rss.load();
      const initialCount = rss.feeds.length;
      await rss.addFeed('https://newfeed.com/rss', 'New Feed');
      expect(rss.feeds.length).toBe(initialCount + 1);
      expect(rss.feeds.some((f) => f.url === 'https://newfeed.com/rss')).toBe(true);
    });

    it('should not add duplicate URL', async () => {
      const rss = useRSSStore();
      await rss.load();
      const initialCount = rss.feeds.length;
      const existingUrl = rss.feeds[0].url;
      await rss.addFeed(existingUrl, 'Duplicate');
      expect(rss.feeds.length).toBe(initialCount);
    });

    it('should use URL as name if name not provided', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addFeed('https://noname.com/rss');
      const feed = rss.feeds.find((f) => f.url === 'https://noname.com/rss');
      expect(feed?.name).toBe('https://noname.com/rss');
    });
  });

  describe('removeFeed', () => {
    it('should remove feed by id', async () => {
      const rss = useRSSStore();
      await rss.load();
      const feedId = rss.feeds[0].id;
      await rss.removeFeed(feedId);
      expect(rss.feeds.find((f) => f.id === feedId)).toBeUndefined();
    });

    it('should also remove digests from that feed', async () => {
      const rss = useRSSStore();
      await rss.load();
      const feedId = rss.feeds[0].id;
      await rss.addDigests([
        { id: `${feedId}:guid1`, feedId, feedName: 'Test', category: 'tech', tags: [], title: 'T', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      expect(rss.digests.length).toBeGreaterThan(0);
      await rss.removeFeed(feedId);
      expect(rss.digests.filter((d) => d.feedId === feedId)).toHaveLength(0);
    });
  });

  describe('toggleFeed', () => {
    it('should toggle enabled state', async () => {
      const rss = useRSSStore();
      await rss.load();
      const feedId = rss.feeds[0].id;
      const initialEnabled = rss.feeds[0].enabled;
      await rss.toggleFeed(feedId);
      expect(rss.feeds[0].enabled).toBe(!initialEnabled);
    });
  });

  describe('updateFeed', () => {
    it('should update feed category and interval', async () => {
      const rss = useRSSStore();
      await rss.load();
      const feedId = rss.feeds[0].id;
      await rss.updateFeed(feedId, { category: 'ai', fetchIntervalMinutes: 120, maxItemsPerFetch: 5, tags: ['test'] });
      const feed = rss.feeds.find((f) => f.id === feedId);
      expect(feed?.category).toBe('ai');
      expect(feed?.fetchIntervalMinutes).toBe(120);
      expect(feed?.maxItemsPerFetch).toBe(5);
      expect(feed?.tags).toEqual(['test']);
    });
  });

  describe('addDigests', () => {
    it('should add new digests', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'feed1:guid1', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T1', url: 'https://t.com/1', publishedAt: Date.now(), fetchedAt: Date.now(), summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      expect(rss.digests).toHaveLength(1);
    });

    it('should not add duplicate digests (dedup by id)', async () => {
      const rss = useRSSStore();
      await rss.load();
      const item: RSSDigestItem = { id: 'feed1:guid1', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T1', url: 'https://t.com/1', publishedAt: Date.now(), fetchedAt: Date.now(), summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] };
      await rss.addDigests([item]);
      await rss.addDigests([item]);
      expect(rss.digests).toHaveLength(1);
    });

    it('should trim to max 100 items', async () => {
      const rss = useRSSStore();
      await rss.load();
      const items: RSSDigestItem[] = [];
      for (let i = 0; i < 110; i++) {
        items.push({
          id: `feed1:guid${i}`,
          feedId: 'feed1',
          feedName: 'F1',
          category: 'tech',
          tags: [],
          title: `T${i}`,
          url: `https://t.com/${i}`,
          publishedAt: Date.now() - i * 1000,
          fetchedAt: Date.now(),
          summary: '',
          isRead: false,
          summarizing: false,
          summaryError: '',
          starred: false,
          laterRead: false,
          aiTags: [],
          matchedKeywords: [],
        });
      }
      await rss.addDigests(items);
      expect(rss.digests.length).toBeLessThanOrEqual(100);
    });
  });

  describe('markAsRead', () => {
    it('should mark a single digest as read', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'feed1:guid1', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T1', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      await rss.markAsRead('feed1:guid1');
      expect(rss.digests[0].isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all digests as read', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'feed1:guid1', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T1', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'feed1:guid2', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T2', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      await rss.markAllAsRead();
      expect(rss.digests.every((d) => d.isRead)).toBe(true);
    });
  });

  describe('markFeedAsRead', () => {
    it('should mark only feed digests as read', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'feed1:guid1', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T1', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'feed2:guid1', feedId: 'feed2', feedName: 'F2', category: 'ai', tags: [], title: 'T2', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      await rss.markFeedAsRead('feed1');
      const d1 = rss.digests.find((d) => d.id === 'feed1:guid1')!;
      const d2 = rss.digests.find((d) => d.id === 'feed2:guid1')!;
      expect(d1.isRead).toBe(true);
      expect(d2.isRead).toBe(false);
    });
  });

  describe('unreadCount', () => {
    it('should count unread digests', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'feed1:guid1', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T1', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'feed1:guid2', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T2', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: true, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'feed1:guid3', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T3', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      expect(rss.unreadCount).toBe(2);
    });
  });

  describe('removeDigest', () => {
    it('should remove a digest by id', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'feed1:guid1', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T1', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      await rss.removeDigest('feed1:guid1');
      expect(rss.digests).toHaveLength(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all digests', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'feed1:guid1', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T1', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'feed1:guid2', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T2', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      await rss.clearAll();
      expect(rss.digests).toHaveLength(0);
    });
  });

  describe('clearReadDigests', () => {
    it('should remove read digests except starred or later read', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'feed1:guid1', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T1', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: true, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'feed1:guid2', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T2', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: true, summarizing: false, summaryError: '', starred: true, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'feed1:guid3', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T3', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      await rss.clearReadDigests();
      expect(rss.digests.map((d) => d.id).sort()).toEqual(['feed1:guid2', 'feed1:guid3']);
    });
  });

  describe('updateDigest', () => {
    it('should update a digest with patch', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'feed1:guid1', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T1', url: '', publishedAt: 0, fetchedAt: 0, summary: '', isRead: false, summarizing: true, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      await rss.updateDigest('feed1:guid1', { summary: 'Updated summary', summarizing: false });
      expect(rss.digests[0].summary).toBe('Updated summary');
      expect(rss.digests[0].summarizing).toBe(false);
    });
  });

  describe('sortedDigests', () => {
    it('should sort unread first, then by publishedAt descending', async () => {
      const rss = useRSSStore();
      await rss.load();
      const now = Date.now();
      await rss.addDigests([
        { id: 'feed1:1', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T1', url: '', publishedAt: now - 1000, fetchedAt: 0, summary: '', isRead: true, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'feed1:2', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T2', url: '', publishedAt: now - 2000, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'feed1:3', feedId: 'feed1', feedName: 'F1', category: 'tech', tags: [], title: 'T3', url: '', publishedAt: now - 500, fetchedAt: 0, summary: '', isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      const sorted = rss.sortedDigests;
      // Unread items first
      expect(sorted[0].isRead).toBe(false);
      expect(sorted[1].isRead).toBe(false);
      expect(sorted[2].isRead).toBe(true);
      // Among unread, newer first
      expect(sorted[0].id).toBe('feed1:3');
      expect(sorted[1].id).toBe('feed1:2');
    });
  });

  // --- Filtering & Search ---

  describe('filteredDigests', () => {
    beforeEach(async () => {
      const rss = useRSSStore();
      await rss.load();
      const now = Date.now();
      await rss.addDigests([
        { id: 'f1:1', feedId: 'f1', feedName: 'F1', category: 'tech', tags: [], title: 'AI News', url: '', summary: 'AI news summary', publishedAt: now, fetchedAt: now, isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'f2:1', feedId: 'f2', feedName: 'F2', category: 'ai', tags: [], title: 'ML Paper', url: '', summary: 'Research paper', publishedAt: now - 1000 * 60 * 60 * 25, fetchedAt: now, isRead: true, summarizing: false, summaryError: '', starred: true, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'f3:1', feedId: 'f3', feedName: 'F3', category: 'product', tags: [], title: 'Product Launch', url: '', summary: 'New product', publishedAt: now, fetchedAt: now, isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: true, aiTags: [], matchedKeywords: [] },
      ]);
    });

    it('should filter by category', async () => {
      const rss = useRSSStore();
      rss.setCategoryFilter(['ai']);
      expect(rss.filteredDigests.map((d) => d.id)).toEqual(['f2:1']);
    });

    it('should filter by unread', async () => {
      const rss = useRSSStore();
      rss.setOnlyUnread(true);
      // addDigests uses unshift so newer items appear first
      expect(rss.filteredDigests.map((d) => d.id)).toEqual(['f3:1', 'f1:1']);
    });

    it('should filter by starred', async () => {
      const rss = useRSSStore();
      rss.setOnlyStarred(true);
      expect(rss.filteredDigests.map((d) => d.id)).toEqual(['f2:1']);
    });

    it('should filter by later read', async () => {
      const rss = useRSSStore();
      rss.setOnlyLaterRead(true);
      expect(rss.filteredDigests.map((d) => d.id)).toEqual(['f3:1']);
    });

    it('should filter by time range', async () => {
      const rss = useRSSStore();
      rss.setMaxAgeHours(24);
      // addDigests uses unshift so newer items appear first
      expect(rss.filteredDigests.map((d) => d.id)).toEqual(['f3:1', 'f1:1']);
    });

    it('should filter by whitelist keywords', async () => {
      const rss = useRSSStore();
      rss.setKeywordFilter(['AI'], []);
      expect(rss.filteredDigests.map((d) => d.id)).toEqual(['f1:1']);
      expect(rss.filteredDigests[0].matchedKeywords).toContain('AI');
    });

    it('should filter by blacklist keywords', async () => {
      const rss = useRSSStore();
      rss.setKeywordFilter([], ['product']);
      expect(rss.filteredDigests.map((d) => d.id)).toEqual(['f1:1', 'f2:1']);
    });

    it('should combine multiple filters', async () => {
      const rss = useRSSStore();
      rss.setCategoryFilter(['tech', 'ai']);
      rss.setKeywordFilter(['AI'], []);
      rss.setOnlyUnread(true);
      expect(rss.filteredDigests.map((d) => d.id)).toEqual(['f1:1']);
    });

    it('should clear filters', async () => {
      const rss = useRSSStore();
      rss.setCategoryFilter(['ai']);
      rss.setOnlyUnread(true);
      rss.clearFilter();
      expect(rss.filteredDigests.length).toBe(3);
    });
  });

  describe('searchDigests', () => {
    it('should search by title or summary', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'f1:1', feedId: 'f1', feedName: 'F1', category: 'tech', tags: [], title: 'Quantum Computing', url: '', summary: 'Quantum summary', publishedAt: Date.now(), fetchedAt: Date.now(), isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'f1:2', feedId: 'f1', feedName: 'F1', category: 'tech', tags: [], title: 'Other', url: '', summary: 'Crypto markets', publishedAt: Date.now(), fetchedAt: Date.now(), isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      expect(rss.searchDigests('Quantum').length).toBe(1);
      expect(rss.searchDigests('markets').length).toBe(1);
      expect(rss.searchDigests('nothing').length).toBe(0);
    });
  });

  // --- Star / Later Read ---

  describe('toggleStar', () => {
    it('should toggle starred state', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'f1:1', feedId: 'f1', feedName: 'F1', category: 'tech', tags: [], title: 'T', url: '', summary: '', publishedAt: 0, fetchedAt: 0, isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      await rss.toggleStar('f1:1');
      expect(rss.digests[0].starred).toBe(true);
      await rss.toggleStar('f1:1');
      expect(rss.digests[0].starred).toBe(false);
    });
  });

  describe('toggleLaterRead', () => {
    it('should toggle later read state', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'f1:1', feedId: 'f1', feedName: 'F1', category: 'tech', tags: [], title: 'T', url: '', summary: '', publishedAt: 0, fetchedAt: 0, isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      await rss.toggleLaterRead('f1:1');
      expect(rss.digests[0].laterRead).toBe(true);
    });
  });

  // --- AI Tags ---

  describe('extractAITags', () => {
    it('should extract tags from summary and persist', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'f1:1', feedId: 'f1', feedName: 'F1', category: 'tech', tags: [], title: 'T', url: '', summary: 'Artificial intelligence, machine learning, deep learning', publishedAt: 0, fetchedAt: 0, isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      await rss.extractAITags('f1:1', rss.digests[0].summary);
      expect(rss.digests[0].aiTags.length).toBeGreaterThan(0);
      expect(rss.digests[0].aiTags.length).toBeLessThanOrEqual(3);
    });
  });

  // --- Global Settings ---

  describe('updateGlobalSettings', () => {
    it('should update global settings and persist', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.updateGlobalSettings({ badgeMode: 'starred', fetchIntervalMinutes: 120 });
      expect(rss.globalSettings.badgeMode).toBe('starred');
      expect(rss.globalSettings.fetchIntervalMinutes).toBe(120);
    });
  });

  describe('badgeCount', () => {
    it('should follow badge mode settings', async () => {
      const rss = useRSSStore();
      await rss.load();
      await rss.addDigests([
        { id: 'f1:1', feedId: 'f1', feedName: 'F1', category: 'tech', tags: [], title: 'T1', url: '', summary: '', publishedAt: 0, fetchedAt: 0, isRead: false, summarizing: false, summaryError: '', starred: false, laterRead: false, aiTags: [], matchedKeywords: [] },
        { id: 'f1:2', feedId: 'f1', feedName: 'F1', category: 'tech', tags: [], title: 'T2', url: '', summary: '', publishedAt: 0, fetchedAt: 0, isRead: true, summarizing: false, summaryError: '', starred: true, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      expect(rss.badgeCount).toBe(1);
      await rss.updateGlobalSettings({ badgeMode: 'all' });
      expect(rss.badgeCount).toBe(2);
      await rss.updateGlobalSettings({ badgeMode: 'starred' });
      expect(rss.badgeCount).toBe(1);
    });
  });

  // --- Categories & Stats ---

  describe('categories', () => {
    it('should list categories with counts', async () => {
      const rss = useRSSStore();
      await rss.load();
      expect(rss.categories.length).toBe(Object.keys(RSS_CATEGORY_META).length);
      const tech = rss.categories.find((c) => c.category === 'tech');
      expect(tech).toBeDefined();
      expect(tech!.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('feedStats', () => {
    it('should compute stats per feed', async () => {
      const rss = useRSSStore();
      await rss.load();
      const feedId = rss.feeds[0].id;
      await rss.addDigests([
        { id: `${feedId}:1`, feedId, feedName: 'F', category: 'tech', tags: [], title: 'T1', url: '', summary: '', publishedAt: 0, fetchedAt: 0, isRead: false, summarizing: false, summaryError: '', starred: true, laterRead: false, aiTags: [], matchedKeywords: [] },
      ]);
      const stats = rss.feedStats.find((s) => s.feedId === feedId);
      expect(stats?.total).toBe(1);
      expect(stats?.unread).toBe(1);
      expect(stats?.starred).toBe(1);
    });
  });

  // --- OPML Import / Export ---

  describe('OPML', () => {
    it('should export and import feeds via store', async () => {
      const rss = useRSSStore();
      await rss.load();
      const opml = rss.exportFeedsOPML();
      expect(opml).toContain('<opml');
      expect(opml).toContain('<outline');
      const count = await rss.importFeedsOPML(`<opml><body><outline type="rss" text="Imported" xmlUrl="https://imported.example/rss" category="science" /></body></opml>`);
      expect(count).toBe(1);
      expect(rss.feeds.some((f) => f.url === 'https://imported.example/rss')).toBe(true);
    });

    it('should not duplicate existing feeds on import', async () => {
      const rss = useRSSStore();
      await rss.load();
      const existingUrl = rss.feeds[0].url;
      const count = await rss.importFeedsOPML(`<opml><body><outline type="rss" text="Dup" xmlUrl="${existingUrl}" /></body></opml>`);
      expect(count).toBe(0);
    });
  });
});

// --- Cross feed title dedup helper ---

describe('cross-feed title dedup', () => {
  it('should detect similar titles across feeds', () => {
    const a = 'Breaking: AI Model Released';
    const b = 'Breaking: AI model released!';
    expect(titlesSimilar(a, b)).toBe(true);
  });
});

// --- Default feeds categories ---

describe('DEFAULT_FEEDS', () => {
  it('should contain known categories', () => {
    expect(DEFAULT_FEEDS.some((f) => f.category === 'tech')).toBe(true);
    expect(DEFAULT_FEEDS.some((f) => f.category === 'ai')).toBe(true);
    expect(DEFAULT_FEEDS.some((f) => f.category === 'product')).toBe(true);
    expect(DEFAULT_FEEDS.some((f) => f.category === 'science')).toBe(true);
    expect(DEFAULT_FEEDS.some((f) => f.category === 'business')).toBe(true);
    expect(DEFAULT_FEEDS.some((f) => f.category === 'design')).toBe(true);
    expect(DEFAULT_FEEDS.some((f) => f.category === 'news')).toBe(true);
  });
});
