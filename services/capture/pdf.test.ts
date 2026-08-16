import { describe, it, expect } from 'vitest'
import { isPdfUrl, arxivId, arxivHtmlUrl, arxivPdfUrl, pdfPagesToMarkdown, type PdfTextItem } from './pdf'

function item(str: string, x: number, y: number, h = 10): PdfTextItem {
  return { str, x, y, height: h }
}

describe('isPdfUrl', () => {
  it('detects .pdf paths and rejects others', () => {
    expect(isPdfUrl('https://arxiv.org/pdf/2301.01234.pdf')).toBe(true)
    expect(isPdfUrl('https://example.com/a/b/paper.PDF')).toBe(true)
    expect(isPdfUrl('https://example.com/article.html')).toBe(false)
    expect(isPdfUrl('not a url')).toBe(false)
  })
})

describe('arxivId', () => {
  it('extracts the id from abs/pdf/html urls, stripping version', () => {
    expect(arxivId('https://arxiv.org/abs/2301.01234')).toBe('2301.01234')
    expect(arxivId('https://arxiv.org/pdf/2301.01234v2')).toBe('2301.01234')
    expect(arxivId('https://arxiv.org/html/2301.01234v3')).toBe('2301.01234')
    expect(arxivId('https://example.com/abs/2301.01234')).toBeNull()
  })

  it('builds canonical html/pdf urls', () => {
    expect(arxivHtmlUrl('2301.01234')).toBe('https://arxiv.org/html/2301.01234')
    expect(arxivPdfUrl('2301.01234')).toBe('https://arxiv.org/pdf/2301.01234')
  })
})

describe('pdfPagesToMarkdown', () => {
  it('joins items on a line and separates lines', () => {
    const md = pdfPagesToMarkdown([
      [item('Hello', 0, 100), item('world', 60, 100), item('second line', 0, 85)],
    ])
    expect(md).toBe('Hello world\nsecond line')
  })

  it('inserts a paragraph break on a large vertical gap', () => {
    const md = pdfPagesToMarkdown([
      [item('Para one', 0, 100), item('Para two', 0, 50)], // 50pt gap on 10pt text
    ])
    expect(md).toBe('Para one\n\nPara two')
  })

  it('drops standalone page-number lines', () => {
    const md = pdfPagesToMarkdown([
      [item('3', 290, 700), item('Body text', 0, 100), item('4', 290, 20)],
    ])
    expect(md).toBe('Body text')
  })

  it('joins pages with a horizontal rule', () => {
    const md = pdfPagesToMarkdown([
      [item('Page one', 0, 100)],
      [item('Page two', 0, 100)],
    ])
    expect(md).toBe('Page one\n\n---\n\nPage two')
  })

  it('returns empty string for pages without text', () => {
    expect(pdfPagesToMarkdown([[], [item('   ', 0, 100)]])).toBe('')
  })
})
