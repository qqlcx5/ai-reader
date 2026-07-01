import { describe, it, expect } from 'vitest'
import { normalizeFeedUrl } from './url'

describe('utils/feed/url — normalizeFeedUrl', () => {
  it('lowercases scheme and host but preserves path case', () => {
    expect(normalizeFeedUrl('HTTPS://Example.COM/Feed')).toBe('https://example.com/Feed')
  })

  it('strips tracking params and keeps meaningful ones', () => {
    expect(normalizeFeedUrl('https://x.com/feed?utm_source=rss&keep=1')).toBe('https://x.com/feed?keep=1')
    expect(normalizeFeedUrl('https://x.com/feed?utm_source=rss&utm_medium=feed')).toBe('https://x.com/feed')
  })

  it('drops the fragment', () => {
    expect(normalizeFeedUrl('https://x.com/feed#top')).toBe('https://x.com/feed')
  })

  it('removes a non-root trailing slash but keeps root "/"', () => {
    expect(normalizeFeedUrl('https://x.com/feed/')).toBe('https://x.com/feed')
    expect(normalizeFeedUrl('https://x.com/')).toBe('https://x.com/')
  })

  it('does not force https or strip www', () => {
    expect(normalizeFeedUrl('http://x.com/feed')).toBe('http://x.com/feed')
    expect(normalizeFeedUrl('https://www.x.com/feed')).toBe('https://www.x.com/feed')
  })

  it('trims whitespace and returns non-URLs unchanged (validation is downstream)', () => {
    expect(normalizeFeedUrl('  https://x.com/feed  ')).toBe('https://x.com/feed')
    expect(normalizeFeedUrl('  not a url  ')).toBe('not a url')
  })

  it('collapses a full duplicate-looking variant to the canonical form', () => {
    expect(normalizeFeedUrl('HTTPS://x.com/Feed/?utm_source=rss#top')).toBe('https://x.com/Feed')
  })
})
