import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractPage, fallbackExtract, computeHash, stripHtml, sanitizeHtml } from './extract'
import type { DefuddleLikeConstructor, DefuddleLikeResult } from './extract'

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''),
  },
}))

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

  return doc
}

const mockDefuddleCtor: DefuddleLikeConstructor = class {
  private doc: Document
  private _options: { url?: string; markdown?: boolean; separateMarkdown?: boolean }
  constructor(doc: Document, options?: any) {
    this.doc = doc
    this._options = options || {}
  }
  parse(): DefuddleLikeResult {
    return {
      title: (this.doc as any)._mockTitle || this.doc.title || 'Test Title',
      site: 'example.com',
      author: 'Test Author',
      description: 'A test page description',
      published: '2026-01-15',
      content: '<p>Hello world</p>',
      contentMarkdown: (this.doc as any)._mockMarkdown ?? 'Hello world\n\nThis is test content.',
    }
  }
}

describe('utils/content/extract', () => {
  describe('stripHtml', () => {
    it('should strip HTML tags and return text', () => {
      expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World')
    })

    it('should return empty string for empty HTML', () => {
      expect(stripHtml('')).toBe('')
    })
  })

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const result = sanitizeHtml('<div>Hi<script>alert(1)</script></div>')
      expect(result).not.toContain('<script>')
      expect(result).toContain('Hi')
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
    it('should extract page with defuddle', async () => {
      const doc = createMockDoc({ title: 'My Page' })
      ;(doc as any)._mockTitle = 'Test Title'

      const result = await extractPage(doc, 'https://example.com', mockDefuddleCtor)

      expect(result.extractionMethod).toBe('defuddle')
      expect(result.title).toBe('Test Title')
      expect(result.siteName).toBe('example.com')
      expect(result.author).toBe('Test Author')
      expect(result.description).toBe('A test page description')
      expect(result.publishedAt).toBe('2026-01-15')
      expect(result.url).toBe('https://example.com')
      expect(result.contentHash).toHaveLength(64)
      expect(result.tokenCount).toBeGreaterThan(0)
      expect(result.wordCount).toBeGreaterThan(0)
    })

    it('should fall back when markdown is empty', async () => {
      const doc = createMockDoc({ title: 'Fallback Page' })

      Object.defineProperty(doc.body, 'innerText', {
        value: 'Fallback content here.',
        writable: true,
      })

      const emptyDefuddleCtor: DefuddleLikeConstructor = class {
        parse(): DefuddleLikeResult {
          return { title: '', contentMarkdown: '' }
        }
      }

      const result = await extractPage(doc, 'https://example.com', emptyDefuddleCtor)

      expect(result.extractionMethod).toBe('fallback')
      expect(result.title).toBe('Fallback Page')
      expect(result.markdown).toContain('Fallback content here.')
    })

    it('should fall back when defuddle throws', async () => {
      const doc = createMockDoc({ title: 'Error Page' })
      Object.defineProperty(doc.body, 'innerText', {
        value: 'Error recovery content.',
        writable: true,
      })

      const throwingDefuddleCtor: DefuddleLikeConstructor = class {
        parse(): DefuddleLikeResult {
          throw new Error('defuddle error')
        }
      }

      const result = await extractPage(doc, 'https://example.com', throwingDefuddleCtor)

      expect(result.extractionMethod).toBe('fallback')
      expect(result.title).toBe('Error Page')
      expect(result.markdown).toContain('Error recovery content.')
    })

    it('should compute correct wordCount', async () => {
      const doc = createMockDoc({ title: 'Word Count Test' })
      ;(doc as any)._mockMarkdown = 'one two three four five'

      const result = await extractPage(doc, 'https://example.com', mockDefuddleCtor)

      expect(result.wordCount).toBe(5)
    })

    it('should compute tokenCount as markdown.length / 4', async () => {
      const doc = createMockDoc({ title: 'Token Test' })
      const md = 'a'.repeat(100)
      ;(doc as any)._mockMarkdown = md

      const result = await extractPage(doc, 'https://example.com', mockDefuddleCtor)

      expect(result.tokenCount).toBe(25)
      expect(result.markdown).toBe(md)
    })
  })

  describe('fallbackExtract', () => {
    it('should use document.title and body.innerText', async () => {
      const doc = createMockDoc({ title: 'Fallback Doc' })
      Object.defineProperty(doc.body, 'innerText', {
        value: 'Some body text\n\n\n\nextra newlines.',
        writable: true,
      })

      const result = await fallbackExtract(doc, 'https://example.com')

      expect(result.extractionMethod).toBe('fallback')
      expect(result.title).toBe('Fallback Doc')
      expect(result.markdown).toContain('# Fallback Doc')
      expect(result.rawText).toContain('Some body text')
      expect(result.rawText).not.toContain('\n\n\n')
    })

    it('should handle empty title', async () => {
      const doc = createMockDoc({ title: '' })
      Object.defineProperty(doc.body, 'innerText', {
        value: 'Only body text.',
        writable: true,
      })

      const result = await fallbackExtract(doc, 'https://example.com')

      expect(result.markdown).toBe('Only body text.')
    })
  })
})
