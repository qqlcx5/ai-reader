import { describe, it, expect } from 'vitest'
import { exportOpml, parseOpml } from './opml'
import type { FeedEntity } from '@/types/feed'

function feed(url: string, title: string, folder?: string): FeedEntity {
  return {
    id: url,
    url,
    title,
    folder,
    siteUrl: 'https://example.com',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('opml', () => {
  it('exports and re-parses a flat list', () => {
    const xml = exportOpml([feed('https://a.test/rss', 'A'), feed('https://b.test/rss', 'B')])
    const subs = parseOpml(xml)
    expect(subs.map((s) => s.xmlUrl).sort()).toEqual(['https://a.test/rss', 'https://b.test/rss'])
  })

  it('round-trips folders', () => {
    const xml = exportOpml([
      feed('https://a.test/rss', 'A', 'Tech'),
      feed('https://b.test/rss', 'B', 'Tech'),
      feed('https://c.test/rss', 'C'),
    ])
    const subs = parseOpml(xml)
    expect(subs.find((s) => s.xmlUrl === 'https://a.test/rss')?.folder).toBe('Tech')
    expect(subs.find((s) => s.xmlUrl === 'https://c.test/rss')?.folder).toBeUndefined()
  })

  it('escapes special characters', () => {
    const xml = exportOpml([feed('https://a.test/rss?t=1&x=2', 'A & B <tag>')])
    expect(xml).toContain('t=1&amp;x=2')
    expect(xml).toContain('A &amp; B &lt;tag&gt;')
    // still parseable
    expect(parseOpml(xml)[0].title).toBe('A & B <tag>')
  })
})
