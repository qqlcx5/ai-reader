import { describe, it, expect } from 'vitest'
import { parseFeed } from './parser'

const RSS2 = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Example Blog</title>
    <link>https://example.com</link>
    <description>Words</description>
    <item>
      <title>First Post</title>
      <link>https://example.com/1</link>
      <guid>https://example.com/1</guid>
      <description>Short summary</description>
      <content:encoded>&lt;p&gt;Full body&lt;/p&gt;</content:encoded>
      <dc:creator>Jane</dc:creator>
      <pubDate>Wed, 15 Jan 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second Post</title>
      <link>https://example.com/2</link>
      <description>Another</description>
      <pubDate>Thu, 16 Jan 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <link rel="alternate" href="https://atom.example.com"/>
  <subtitle>sub</subtitle>
  <entry>
    <id>tag:atom.example.com,2026:/1</id>
    <title>An Entry</title>
    <link rel="alternate" href="https://atom.example.com/1"/>
    <published>2026-02-01T00:00:00Z</published>
    <updated>2026-02-02T00:00:00Z</updated>
    <summary>brief</summary>
    <author><name>Sam</name></author>
  </entry>
</feed>`

describe('parseFeed', () => {
  it('parses RSS 2.0 channel + items', () => {
    const feed = parseFeed(RSS2)
    expect(feed.title).toBe('Example Blog')
    expect(feed.siteUrl).toBe('https://example.com')
    expect(feed.items).toHaveLength(2)
  })

  it('extracts guid, content:encoded, dc:creator, pubDate', () => {
    const feed = parseFeed(RSS2)
    const first = feed.items[0]
    expect(first.guid).toBe('https://example.com/1')
    expect(first.title).toBe('First Post')
    expect(first.contentHtml).toContain('Full body')
    expect(first.author).toBe('Jane')
    expect(first.publishedAt).toContain('Jan 2026')
  })

  it('falls back to link as guid when guid is absent', () => {
    const second = parseFeed(RSS2).items[1]
    expect(second.guid).toBe('https://example.com/2')
    expect(second.contentHtml).toBeUndefined()
  })

  it('parses Atom feeds', () => {
    const feed = parseFeed(ATOM)
    expect(feed.title).toBe('Atom Feed')
    expect(feed.siteUrl).toBe('https://atom.example.com')
    const entry = feed.items[0]
    expect(entry.title).toBe('An Entry')
    expect(entry.link).toBe('https://atom.example.com/1')
    expect(entry.guid).toBe('tag:atom.example.com,2026:/1')
    expect(entry.author).toBe('Sam')
    expect(entry.publishedAt).toBe('2026-02-01T00:00:00Z')
  })

  it('throws on invalid XML', () => {
    expect(() => parseFeed('<not><closed>')).toThrow(/Invalid feed XML/)
  })
})
