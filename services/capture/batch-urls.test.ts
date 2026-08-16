import { describe, it, expect } from 'vitest'
import { parseUrlList } from './batch-urls'

describe('parseUrlList', () => {
  it('extracts http(s) URLs from messy pasted text', () => {
    const text = [
      'https://example.com/a',
      'http://example.org/b',
      '随便一句话 https://example.com/c 结束',
      'not a url',
      'ftp://skip.me',
      'https://example.com/a', // duplicate
    ].join('\n')
    expect(parseUrlList(text)).toEqual([
      'https://example.com/a',
      'http://example.org/b',
      'https://example.com/c',
    ])
  })

  it('handles comma/semicolon separated lists and trims', () => {
    expect(parseUrlList(' https://a.com/x , https://b.com/y ;https://c.com/z ')).toEqual([
      'https://a.com/x',
      'https://b.com/y',
      'https://c.com/z',
    ])
  })

  it('caps at 100 urls and returns empty for no urls', () => {
    expect(parseUrlList(Array.from({ length: 150 }, (_, i) => `https://a.com/${i}`).join('\n'))).toHaveLength(100)
    expect(parseUrlList('没有任何链接')).toEqual([])
  })
})
