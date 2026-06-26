// ============================================================
// PageMind — Metadata Extractor Unit Tests
// ============================================================

import { describe, it, expect } from 'vitest'
import { extractMetadata, estimateReadingTime } from './metadata-extractor'

function makeDoc(metaTags: Array<{ attr: string; value: string; content: string }>, opts?: {
  title?: string
  lang?: string
  jsonLdContent?: string
  faviconHref?: string
  timeDatetime?: string
}) {
  const { JSDOM } = require('jsdom')
  const metaHTML = metaTags
    .map(m => `<meta ${m.attr}="${m.value}" content="${m.content}">`)
    .join('\n')
  const jsonLdHTML = opts?.jsonLdContent
    ? `<script type="application/ld+json">${opts.jsonLdContent}</script>`
    : ''
  const faviconHTML = opts?.faviconHref
    ? `<link rel="icon" href="${opts.faviconHref}">`
    : ''
  const timeHTML = opts?.timeDatetime
    ? `<time datetime="${opts.timeDatetime}">${opts.timeDatetime}</time>`
    : ''
  const langAttr = opts?.lang ? ` lang="${opts.lang}"` : ''
  // Use ?? so empty-string title is preserved (for hostname fallback test)
  const titleTag = opts?.title !== undefined
    ? `<title>${opts.title}</title>`
    : '<title>Default Title</title>'

  const html = `<!DOCTYPE html><html${langAttr}><head>
    ${titleTag}
    ${metaHTML}
    ${jsonLdHTML}
    ${faviconHTML}
  </head><body>${timeHTML}<p>这是一段测试文本用于阅读时间估算。This is English text for reading time estimation.</p></body></html>`

  return new JSDOM(html).window.document
}

describe('extractMetadata', () => {
  describe('title priority', () => {
    it('returns og:title when available', () => {
      const doc = makeDoc([
        { attr: 'property', value: 'og:title', content: 'OG Title' },
        { attr: 'name', value: 'twitter:title', content: 'Twitter Title' },
      ], { title: 'Doc Title' })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.title).toBe('OG Title')
    })

    it('falls back to twitter:title when og:title missing', () => {
      const doc = makeDoc([
        { attr: 'name', value: 'twitter:title', content: 'Twitter Title' },
      ], { title: 'Doc Title' })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.title).toBe('Twitter Title')
    })

    it('falls back to document.title when no social tags', () => {
      const doc = makeDoc([], { title: 'Doc Title' })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.title).toBe('Doc Title')
    })

    it('falls back to hostname when title is empty', () => {
      const doc = makeDoc([], { title: '' })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.title).toBe('example.com')
    })
  })

  describe('siteName priority', () => {
    it('returns og:site_name when available', () => {
      const doc = makeDoc([
        { attr: 'property', value: 'og:site_name', content: 'My Blog' },
      ])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.siteName).toBe('My Blog')
    })

    it('falls back to hostname when og:site_name missing', () => {
      const doc = makeDoc([])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.siteName).toBe('example.com')
    })
  })

  describe('author priority', () => {
    it('returns article:author (property) when available', () => {
      const doc = makeDoc([
        { attr: 'property', value: 'article:author', content: 'John Doe' },
        { attr: 'name', value: 'author', content: 'Jane Smith' },
      ])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.author).toBe('John Doe')
    })

    it('returns article:author (name) as fallback', () => {
      const doc = makeDoc([
        { attr: 'name', value: 'article:author', content: 'Article Author' },
      ])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.author).toBe('Article Author')
    })

    it('falls back to meta[name=author]', () => {
      const doc = makeDoc([
        { attr: 'name', value: 'author', content: 'Meta Author' },
      ])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.author).toBe('Meta Author')
    })

    it('extracts author from JSON-LD string', () => {
      const doc = makeDoc([], {
        jsonLdContent: JSON.stringify({ author: 'JSON-LD Author' }),
      })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.author).toBe('JSON-LD Author')
    })

    it('extracts author from JSON-LD object with name', () => {
      const doc = makeDoc([], {
        jsonLdContent: JSON.stringify({ author: { '@type': 'Person', name: 'Person Name' } }),
      })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.author).toBe('Person Name')
    })

    it('extracts author from JSON-LD array', () => {
      const doc = makeDoc([], {
        jsonLdContent: JSON.stringify({ author: ['First Author', 'Second Author'] }),
      })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.author).toBe('First Author')
    })

    it('extracts author from JSON-LD @graph', () => {
      const doc = makeDoc([], {
        jsonLdContent: JSON.stringify({
          '@graph': [{ '@type': 'Article', author: 'Graph Author' }],
        }),
      })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.author).toBe('Graph Author')
    })

    it('returns undefined when no author info', () => {
      const doc = makeDoc([])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.author).toBeUndefined()
    })
  })

  describe('publishedAt priority', () => {
    it('returns article:published_time when available', () => {
      const doc = makeDoc([
        { attr: 'property', value: 'article:published_time', content: '2024-01-15T10:00:00Z' },
      ])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.publishedAt).toBe('2024-01-15T10:00:00Z')
    })

    it('falls back to JSON-LD datePublished', () => {
      const doc = makeDoc([], {
        jsonLdContent: JSON.stringify({ datePublished: '2024-02-01' }),
      })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.publishedAt).toBe('2024-02-01')
    })

    it('falls back to JSON-LD dateCreated', () => {
      const doc = makeDoc([], {
        jsonLdContent: JSON.stringify({ dateCreated: '2024-03-01' }),
      })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.publishedAt).toBe('2024-03-01')
    })

    it('falls back to time element with datetime', () => {
      const doc = makeDoc([], { timeDatetime: '2024-04-01' })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.publishedAt).toBe('2024-04-01')
    })

    it('returns undefined when no date info', () => {
      const doc = makeDoc([])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.publishedAt).toBeUndefined()
    })
  })

  describe('description priority', () => {
    it('returns og:description when available', () => {
      const doc = makeDoc([
        { attr: 'property', value: 'og:description', content: 'OG Desc' },
        { attr: 'name', value: 'description', content: 'Meta Desc' },
      ])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.description).toBe('OG Desc')
    })

    it('falls back to meta[name=description]', () => {
      const doc = makeDoc([
        { attr: 'name', value: 'description', content: 'Meta Desc' },
      ])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.description).toBe('Meta Desc')
    })

    it('returns undefined when no description', () => {
      const doc = makeDoc([])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.description).toBeUndefined()
    })
  })

  describe('faviconUrl', () => {
    it('returns favicon href when present', () => {
      const doc = makeDoc([], { faviconHref: '/favicon.ico' })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.faviconUrl).toBe('/favicon.ico')
    })

    it('returns undefined when no favicon', () => {
      const doc = makeDoc([])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.faviconUrl).toBeUndefined()
    })
  })

  describe('lang', () => {
    it('returns html lang attribute', () => {
      const doc = makeDoc([], { lang: 'zh-CN' })
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.lang).toBe('zh-CN')
    })

    it('returns undefined when no lang attribute', () => {
      const doc = makeDoc([])
      const result = extractMetadata(doc, 'https://example.com/article')
      expect(result.lang).toBeUndefined()
    })
  })
})

describe('estimateReadingTime', () => {
  it('estimates CJK text at 300 chars/min', () => {
    const text = '中'.repeat(300)
    expect(estimateReadingTime(text)).toBe(1)
  })

  it('estimates Latin text at 200 words/min', () => {
    const text = 'word '.repeat(200).trim()
    expect(estimateReadingTime(text)).toBe(1)
  })

  it('estimates mixed CJK/Latin text correctly', () => {
    const cjk = '中'.repeat(300)
    const latin = ' word'.repeat(100)
    expect(estimateReadingTime(cjk + latin)).toBe(2)
  })

  it('returns at least 1 minute', () => {
    expect(estimateReadingTime('hi')).toBe(1)
    expect(estimateReadingTime('')).toBe(1)
  })

  it('rounds to nearest integer', () => {
    const text = '中'.repeat(150)
    expect(estimateReadingTime(text)).toBe(1)
    const text2 = '中'.repeat(450)
    expect(estimateReadingTime(text2)).toBe(2)
  })
})
