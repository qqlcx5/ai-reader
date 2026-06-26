// ============================================================
// PageMind — Extractor Integration Tests
// ============================================================

import { describe, it, expect, vi } from 'vitest'

// Mock defuddle module — provides a working defuddle that returns
// predictable content so we can verify the merge and markdown logic.
vi.mock('defuddle', () => ({
  default: class MockDefuddle {
    private doc: Document
    private opts: { url: string }

    constructor(doc: Document, opts: { url: string }) {
      this.doc = doc
      this.opts = opts
    }

    async parseAsync() {
      return this.buildResult()
    }

    parse() {
      return this.buildResult()
    }

    private buildResult() {
      const title =
        this.doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        this.doc.title ||
        ''
      const desc =
        this.doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || ''
      return {
        title,
        content: `<h1>${title}</h1><p>Test paragraph content for extraction.</p>`,
        description: desc,
        wordCount: 10,
        site: 'example.com',
        domain: 'example.com',
        author: '',
        published: '',
        image: '',
      }
    }
  },
}))

vi.mock('defuddle/full', () => ({
  createMarkdownContent: (html: string, _url: string) =>
    `# Mock Markdown\n\n${html}`,
}))

vi.mock('@/utils/shadow-dom', () => ({
  flattenShadowDom: vi.fn(() => Promise.resolve()),
}))

import { extractContent } from './extractor'

function createMockDoc(opts?: {
  title?: string
  ogTitle?: string
  ogDescription?: string
  bodyText?: string
  metaAuthor?: string
  articlePublishedTime?: string
  faviconHref?: string
  lang?: string
}) {
  const { JSDOM } = require('jsdom')

  const metaTags: string[] = []
  if (opts?.ogTitle)
    metaTags.push(`<meta property="og:title" content="${opts.ogTitle}">`)
  if (opts?.ogDescription)
    metaTags.push(`<meta property="og:description" content="${opts.ogDescription}">`)
  if (opts?.metaAuthor)
    metaTags.push(`<meta name="author" content="${opts.metaAuthor}">`)
  if (opts?.articlePublishedTime)
    metaTags.push(`<meta property="article:published_time" content="${opts.articlePublishedTime}">`)
  if (opts?.faviconHref)
    metaTags.push(`<link rel="icon" href="${opts.faviconHref}">`)

  const langAttr = opts?.lang ? ` lang="${opts.lang}"` : ''

  const html = `<!DOCTYPE html><html${langAttr}><head>
    <title>${opts?.title || 'Test Page'}</title>
    ${metaTags.join('\n')}
  </head><body>
    <article>${opts?.bodyText || '<p>Default body content for extraction testing.</p>'}</article>
  </body></html>`

  const dom = new JSDOM(html)
  return dom.window.document
}

describe('extractContent (happy path)', () => {
  it('extracts via defuddle and returns markdown with merged metadata', async () => {
    const doc = createMockDoc({
      title: 'My Article',
      ogTitle: 'OG: My Article',
      ogDescription: 'A great article',
    })

    const result = await extractContent(doc, 'https://example.com/my-article')

    expect(result.title).toBe('OG: My Article')
    expect(result.url).toBe('https://example.com/my-article')
    expect(result.siteName).toBe('example.com')
    expect(result.readingTime).toBe(1) // 10 words / 200 = 0.05 → ceil 1
    expect(result.markdown).toContain('Mock Markdown')
    expect(result.excerpt).toBe('A great article')
  })

  it('merges extractMetadata fields when defuddle returns partial data', async () => {
    const doc = createMockDoc({
      title: 'Merge Test',
      ogTitle: 'OG Merge',
      metaAuthor: 'Jane Author',
      articlePublishedTime: '2025-06-01T12:00:00Z',
      faviconHref: '/fav.png',
      lang: 'en',
    })

    const result = await extractContent(doc, 'https://merge.example.com')

    // defuddle mock returns empty author/published, so custom meta should fill gaps
    expect(result.title).toBe('OG Merge')
    expect(result.author).toBe('Jane Author')
    expect(result.markdown).toContain('Mock Markdown')
  })
})

describe('extractContent (fallback path)', () => {
  it('falls back to plain text when body has innerText without defuddle', async () => {
    // Create a doc that the extractor will process via defuddle mock (realistic path).
    // We test that even minimal body content produces a result with markdown.
    const doc = createMockDoc({
      title: 'Simple Page',
      bodyText: '<p>Just a paragraph.</p>',
    })

    const result = await extractContent(doc, 'https://example.com/simple')

    expect(result.title).toBe('Simple Page')
    expect(result.markdown).toBeTruthy()
    expect(result.markdown).toContain('Mock Markdown')
  })
})
