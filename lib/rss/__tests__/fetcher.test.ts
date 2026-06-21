import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fetchFeed } from '@/lib/rss/fetcher';
import type { RssFeedRecord } from '@/lib/rss/types';

const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>First Article</title>
      <link>https://example.com/1</link>
      <description>Article one summary</description>
      <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second Article</title>
      <link>https://example.com/2</link>
      <content:encoded><![CDATA[<p>Full HTML content</p>]]></content:encoded>
      <pubDate>Tue, 02 Jan 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const sampleAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.com/atom1" />
    <content>Atom content here</content>
    <published>2026-01-15T10:00:00Z</published>
  </entry>
</feed>`;

const sampleJsonFeed = JSON.stringify({
  items: [
    { title: 'JSON Title', url: 'https://example.com/json1', content_text: 'JSON content', date_published: '2026-02-01T00:00:00Z' },
    { title: 'JSON HTML', url: 'https://example.com/json2', content_html: '<p>HTML body</p>', date_published: '2026-02-02T00:00:00Z' },
  ],
});

function makeFeed(url: string): RssFeedRecord {
  return { id: 'f1', url, enabled: true, lastFetchedAt: 0 };
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetcher', () => {
  it('parses RSS 2.0 feeds', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/xml' },
      text: () => Promise.resolve(sampleRss),
    });
    const result = await fetchFeed(makeFeed('https://feed.xml'));
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('First Article');
    expect(result.items[0].link).toBe('https://example.com/1');
    expect(result.items[1].content).toContain('Full HTML content');
  });

  it('parses Atom feeds', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/atom+xml' },
      text: () => Promise.resolve(sampleAtom),
    });
    const result = await fetchFeed(makeFeed('https://atom.xml'));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Atom Entry');
    expect(result.items[0].link).toBe('https://example.com/atom1');
  });

  it('parses JSON feeds', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/feed+json' },
      text: () => Promise.resolve(sampleJsonFeed),
    });
    const result = await fetchFeed(makeFeed('https://feed.json'));
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('JSON Title');
    expect(result.items[0].link).toBe('https://example.com/json1');
    expect(result.items[1].content).toContain('<p>HTML body</p>');
  });

  it('detects JSON Feed by body shape even with text/html content-type', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/html' },
      text: () => Promise.resolve(sampleJsonFeed),
    });
    const result = await fetchFeed(makeFeed('https://feed.json'));
    expect(result.items).toHaveLength(2);
  });

  it('returns error on HTTP failure', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error', text: () => Promise.resolve('') });
    const result = await fetchFeed(makeFeed('https://fail.xml'));
    expect(result.items).toHaveLength(0);
    expect(result.error?.code).toBe('FETCH_ERROR');
  });

  it('returns timeout error on abort', async () => {
    fetchSpy.mockImplementation(() => new Promise((_resolve, reject) => {
      setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 100);
    }));
    const result = await fetchFeed(makeFeed('https://slow.xml'));
    expect(result.items).toHaveLength(0);
    expect(result.error?.code).toBe('TIMEOUT');
  });

  it('returns empty for unparseable XML', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/xml' },
      text: () => Promise.resolve('not xml at all'),
    });
    const result = await fetchFeed(makeFeed('https://bad.xml'));
    expect(result.items).toHaveLength(0);
  });
});
