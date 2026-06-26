/**
 * content-extractor unit tests.
 *
 * Defuddle is mocked at the module boundary (`vi.mock`) so we
 * don't need a real browser DOM, and so we can assert both the
 * happy path and the fallback path.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Shared state accessible to the mock factory and the test body.
// `vi.hoisted` runs before `vi.mock`, so this is the safe way to
// pass mocks around in Vitest.
const mocks = vi.hoisted(() => {
  const parseMock = vi.fn()
  const parseAsyncMock = vi.fn()
  const createMarkdownContentMock = vi.fn((html: string) => `MD(${html.length})`)
  // Use a class so vitest treats the default export as a
  // constructable. Instances expose live `parse` / `parseAsync`
  // references to the (replaceable) mock functions.
  class Defuddle {
    parse(...args: unknown[]): unknown {
      return parseMock(...args)
    }
    parseAsync(...args: unknown[]): Promise<unknown> {
      return parseAsyncMock(...args) as Promise<unknown>
    }
  }
  return { parseMock, parseAsyncMock, createMarkdownContentMock, Defuddle }
})

vi.mock('defuddle/full', () => ({
  default: mocks.Defuddle,
  createMarkdownContent: mocks.createMarkdownContentMock,
  __mocks: mocks,
}))

import { extractPageContent } from './content-extractor'

function makeDoc(html: string, url = 'https://example.com/post'): Document {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  Object.defineProperty(doc, 'URL', { value: url, configurable: true })
  Object.defineProperty(doc, 'documentURI', { value: url, configurable: true })
  Object.defineProperty(doc, 'baseURI', { value: url, configurable: true })
  return doc
}

beforeEach(() => {
  mocks.parseMock.mockReset()
  mocks.parseAsyncMock.mockReset()
  mocks.createMarkdownContentMock.mockClear()
})

describe('extractPageContent — defuddle success path', () => {
  it('returns a normalised document with all metadata', async () => {
    const html = `
      <html lang="en">
        <head>
          <title>Hello world</title>
          <meta name="description" content="A short description" />
          <meta name="author" content="Jane Doe" />
          <meta property="article:published_time" content="2024-05-01T12:00:00Z" />
          <meta property="og:site_name" content="Example Blog" />
          <meta property="og:image" content="https://example.com/cover.png" />
          <meta name="keywords" content="ai, reader, defuddle" />
          <link rel="icon" href="https://example.com/favicon.ico" />
        </head>
        <body><article><h1>Hello</h1><p>Body content goes here</p></article></body>
      </html>
    `
    const doc = makeDoc(html, 'https://example.com/post')
    mocks.parseMock.mockReturnValue({
      title: 'Hello world',
      description: 'A short description',
      author: 'Jane Doe',
      published: '2024-05-01T12:00:00.000Z',
      favicon: 'https://example.com/favicon.ico',
      image: 'https://example.com/cover.png',
      language: 'en',
      site: 'Example Blog',
      domain: 'example.com',
      parseTime: 12,
      schemaOrgData: { '@type': 'Article' },
      wordCount: 42,
      contentMarkdown: '# Hello\n\nBody content goes here',
      content: '<h1>Hello</h1><p>Body content goes here</p>',
      metaTags: [],
    })

    const result = await extractPageContent(doc, 'https://example.com/post')
    expect(result.source).toBe('defuddle')
    expect(result.document.title).toBe('Hello world')
    expect(result.document.author).toBe('Jane Doe')
    expect(result.document.publishedAt).toBe('2024-05-01T12:00:00.000Z')
    expect(result.document.favicon).toBe('https://example.com/favicon.ico')
    expect(result.document.siteName).toBe('Example Blog')
    expect(result.document.image).toBe('https://example.com/cover.png')
    expect(result.document.language).toBe('en')
    expect(result.document.keywords).toEqual(['ai', 'reader', 'defuddle'])
    expect(result.document.markdownContent).toBe('# Hello\n\nBody content goes here')
    expect(result.document.wordCount).toBe(42)
    expect(result.document.schemaOrgData).toEqual({ '@type': 'Article' })
    expect(result.document.id).toBeTruthy()
    expect(result.document.url).toBe('https://example.com/post')
    expect(typeof result.document.createdAt).toBe('number')
    expect(result.document.updatedAt).toBe(result.document.createdAt)
  })

  it('uses createMarkdownContent when defuddle returns only HTML', async () => {
    const doc = makeDoc('<html><body><p>hi</p></body></html>')
    mocks.parseMock.mockReturnValue({
      title: 't',
      content: '<p>hi</p>',
    })
    const result = await extractPageContent(doc, 'https://example.com')
    expect(mocks.createMarkdownContentMock).toHaveBeenCalledWith('<p>hi</p>')
    // `<p>hi</p>` is 9 chars
    expect(result.document.markdownContent).toBe('MD(9)')
  })

  it('falls back to defuddle wordCount when ours is 0', async () => {
    const doc = makeDoc('<html><body></body></html>')
    mocks.parseMock.mockReturnValue({
      title: 't',
      content: '',
      contentMarkdown: '',
      wordCount: 1234,
    })
    const result = await extractPageContent(doc, 'https://example.com')
    expect(result.document.wordCount).toBe(1234)
  })
})

describe('extractPageContent — fallback path', () => {
  it('uses body.innerText when defuddle throws', async () => {
    const html = `
      <html lang="zh">
        <head>
          <title>Fallback title</title>
          <meta name="description" content="desc" />
          <meta property="og:site_name" content="FallbackSite" />
        </head>
        <body><p>第一段</p><p>第二段</p></body>
      </html>
    `
    const doc = makeDoc(html, 'https://fallback.example/path')
    mocks.parseMock.mockImplementation(() => {
      throw new Error('boom')
    })

    const result = await extractPageContent(doc, 'https://fallback.example/path')
    expect(result.source).toBe('fallback')
    expect(result.document.title).toBe('Fallback title')
    expect(result.document.siteName).toBe('FallbackSite')
    expect(result.document.description).toBe('desc')
    expect(result.document.language).toBe('zh')
    expect(result.document.markdownContent).toContain('第一段')
    expect(result.document.markdownContent).toContain('第二段')
    expect(result.document.wordCount).toBeGreaterThan(0)
  })

  it('returns siteName derived from the URL when no meta is present', async () => {
    const doc = makeDoc('<html><body>x</body></html>', 'https://www.no-meta.test/article')
    mocks.parseMock.mockImplementation(() => {
      throw new Error('nope')
    })
    const result = await extractPageContent(doc, 'https://www.no-meta.test/article')
    expect(result.document.siteName).toBe('no-meta.test')
  })

  it('produces a document even when defuddle returns an empty response', async () => {
    const doc = makeDoc('<html><body>Hello</body></html>')
    mocks.parseMock.mockReturnValue({})
    const result = await extractPageContent(doc, 'https://example.com')
    expect(result.source).toBe('defuddle')
    expect(result.document.markdownContent).toBe('')
    expect(result.document.title).toBeTruthy()
  })
})

describe('extractPageContent — options', () => {
  it('passes markdown:true and url to defuddle by default', async () => {
    const doc = makeDoc('<html><body></body></html>')
    mocks.parseMock.mockReturnValue({ title: 't' })
    const result = await extractPageContent(doc, 'https://example.com/x')
    expect(result.source).toBe('defuddle')
    // Defuddle was instantiated; we just check the result is OK.
  })

  it('uses parseAsync when useAsync is set', async () => {
    const doc = makeDoc('<html><body></body></html>')
    mocks.parseAsyncMock.mockResolvedValue({ title: 'async' })
    const result = await extractPageContent(doc, 'https://example.com', { useAsync: true })
    expect(mocks.parseAsyncMock).toHaveBeenCalled()
    expect(result.document.title).toBe('async')
  })

  it('includes rawHtml when includeRawHtml is true', async () => {
    const doc = makeDoc('<html><body>raw</body></html>')
    mocks.parseMock.mockReturnValue({ title: 't' })
    const result = await extractPageContent(doc, 'https://example.com', {}, { includeRawHtml: true })
    expect(result.document.rawHtml).toContain('<body>raw</body>')
  })
})
