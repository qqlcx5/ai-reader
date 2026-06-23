import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fetchFeed } from '@/lib/rss/fetcher';

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
      <description>Second description</description>
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
    const result = await fetchFeed('https://feed.xml');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('First Article');
    expect(result.items[0].link).toBe('https://example.com/1');
    expect(result.feedTitle).toBe('Test Feed');
  });

  it('parses Atom feeds', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/atom+xml' },
      text: () => Promise.resolve(sampleAtom),
    });
    const result = await fetchFeed('https://atom.xml');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Atom Entry');
    expect(result.items[0].link).toBe('https://example.com/atom1');
  });

  it('throws on HTTP failure', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    await expect(fetchFeed('https://fail.xml')).rejects.toThrow('HTTP 500');
  });

  it('throws on network abort', async () => {
    fetchSpy.mockImplementation(() =>
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 10);
      })
    );
    await expect(fetchFeed('https://slow.xml')).rejects.toThrow();
  });

  it('returns empty items for unparseable XML', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/xml' },
      text: () => Promise.resolve('not xml at all'),
    });
    const result = await fetchFeed('https://bad.xml');
    expect(result.items).toHaveLength(0);
  });
});
