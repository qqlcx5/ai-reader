import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeHash, extractPage, cleanFullHtml, extractFromHtml } from './extract'

let digestCallCount = 0

beforeEach(() => {
  digestCallCount = 0

  Object.defineProperty(globalThis, 'crypto', {
    value: {
      subtle: {
        digest: (_algo: string, _data: Uint8Array) => {
          digestCallCount++
          const preimage = _data.length > 0 ? _data[0] + digestCallCount : digestCallCount
          const buf = new Uint8Array(32)
          for (let i = 0; i < 32; i++) buf[i] = preimage + i
          return Promise.resolve(buf.buffer)
        },
      },
      getRandomValues: (arr: Uint8Array) => arr,
    },
    writable: true,
    configurable: true,
  })
})

function createMockDoc(overrides: Partial<Document> = {}): Document {
  const parser = new DOMParser()
  const html = '<html><head><title></title></head><body></body></html>'
  const doc = parser.parseFromString(html, 'text/html')

  if (overrides.title) {
    Object.defineProperty(doc, 'title', { value: overrides.title, writable: true })
  }
  if (overrides.body) {
    Object.defineProperty(doc, 'body', { value: overrides.body, writable: true })
  }

  // Mock baseURI for URL resolution
  if (!Object.getOwnPropertyDescriptor(doc, 'baseURI')) {
    Object.defineProperty(doc, 'baseURI', {
      value: 'https://example.com/',
      writable: true,
    })
  }

  return doc
}

// Mock Defuddle module
vi.mock('defuddle', () => ({
  default: vi.fn(),
}))

vi.mock('defuddle/full', () => ({
  createMarkdownContent: (content: string, _url: string) => content.replace(/<[^>]+>/g, ''),
}))

describe('utils/content/extract', () => {
  describe('cleanFullHtml', () => {
    it('should remove script and style tags', () => {
      const parser = new DOMParser()
      const doc = parser.parseFromString(
        '<html><head><style>.x{color:red}</style><script>alert(1)</script></head><body><p>Hello</p></body></html>',
        'text/html',
      )
      Object.defineProperty(doc, 'baseURI', { value: 'https://example.com/', writable: true })

      const result = cleanFullHtml(doc)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('<style>')
      expect(result).toContain('Hello')
    })

    it('should strip style attributes', () => {
      const parser = new DOMParser()
      const doc = parser.parseFromString(
        '<html><body><p style="color:red">Text</p></body></html>',
        'text/html',
      )
      Object.defineProperty(doc, 'baseURI', { value: 'https://example.com/', writable: true })

      const result = cleanFullHtml(doc)
      expect(result).not.toContain('style="color:red"')
      expect(result).toContain('Text')
    })

    it('should resolve relative urls to absolute', () => {
      const parser = new DOMParser()
      const doc = parser.parseFromString(
        '<html><body><img src="/images/photo.jpg"><a href="/page">link</a></body></html>',
        'text/html',
      )
      Object.defineProperty(doc, 'baseURI', { value: 'https://example.com/', writable: true })

      const result = cleanFullHtml(doc)
      expect(result).toContain('https://example.com/images/photo.jpg')
      expect(result).toContain('https://example.com/page')
    })
  })

  describe('computeHash', () => {
    it('should return 64-char hex string', async () => {
      const hash = await computeHash('hello')
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[0-9a-f]+$/)
    })

    it('should produce different hashes for different inputs', async () => {
      const h1 = await computeHash('hello')
      const h2 = await computeHash('world')
      expect(h1).not.toBe(h2)
    })
  })

  describe('extractPage', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should extract page with defuddle returning valid content', async () => {
      const Defuddle = (await import('defuddle')).default as any
      Defuddle.mockImplementation(function (this: any, _doc: Document, _opts: any) {
        this.parse = () => ({
          title: 'Test Title',
          site: 'example.com',
          author: 'Test Author',
          description: 'A test description',
          published: '2026-01-15',
          content: '<p>Hello world</p>',
        })
        this.parseAsync = () => Promise.resolve({
          title: 'Test Title',
          site: 'example.com',
          author: 'Test Author',
          description: 'A test description',
          published: '2026-01-15',
          content: '<p>Hello world</p>',
        })
      })

      const doc = createMockDoc({ title: 'My Page' })

      const result = await extractPage(doc, 'https://example.com')

      expect(result.extractionMethod).toBe('defuddle')
      expect(result.title).toBe('Test Title')
      expect(result.siteName).toBe('example.com')
      expect(result.author).toBe('Test Author')
      expect(result.url).toBe('https://example.com')
      expect(result.contentHash).toHaveLength(64)
      expect(result.tokenCount).toBeGreaterThan(0)
      expect(result.wordCount).toBeGreaterThan(0)
    })

    it('should fall back when defuddle returns empty content', async () => {
      const Defuddle = (await import('defuddle')).default as any
      Defuddle.mockImplementation(function (this: any, _doc: Document, _opts: any) {
        this.parse = () => ({
          title: '',
          content: '',
        })
        this.parseAsync = () => Promise.resolve({
          title: '',
          content: '',
        })
      })

      const doc = createMockDoc({ title: 'Fallback Page' })
      Object.defineProperty(doc.body, 'innerText', {
        value: 'Fallback content here.',
        writable: true,
      })

      const result = await extractPage(doc, 'https://example.com')

      expect(result.extractionMethod).toBe('fallback')
      expect(result.title).toBe('Fallback Page')
      expect(result.markdown).toContain('Fallback content here.')
    })

    it('should fall back when defuddle throws', async () => {
      const Defuddle = (await import('defuddle')).default as any
      Defuddle.mockImplementation(function (this: any, _doc: Document, _opts: any) {
        this.parse = () => {
          throw new Error('defuddle error')
        }
        this.parseAsync = () => Promise.reject(new Error('defuddle error'))
      })

      const doc = createMockDoc({ title: 'Error Page' })
      Object.defineProperty(doc.body, 'innerText', {
        value: 'Error recovery content.',
        writable: true,
      })

      const result = await extractPage(doc, 'https://example.com')

      expect(result.extractionMethod).toBe('fallback')
      expect(result.title).toBe('Error Page')
      expect(result.markdown).toContain('Error recovery content.')
    })
  })

  describe('extractFromHtml', () => {
    it('converts HTML to markdown and stamps the rss extraction method', async () => {
      const d = await extractFromHtml(
        '<p>hello world from rss body</p>',
        'https://example.com/a',
        { title: 'T', author: 'A', publishedAt: '2024-01-01' },
      )
      expect(d.extractionMethod).toBe('rss')
      expect(d.markdown).toBe('hello world from rss body')
      expect(d.wordCount).toBe(5)
      expect(d.title).toBe('T')
      expect(d.author).toBe('A')
      expect(d.publishedAt).toBe('2024-01-01')
    })

    it('defaults title to empty and counts zero words for blank html', async () => {
      const d = await extractFromHtml('', 'https://example.com/a')
      expect(d.wordCount).toBe(0)
      expect(d.title).toBe('')
    })
  })
})
