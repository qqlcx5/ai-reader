import { describe, it, expect } from 'vitest'
import { highlightsToMarkdown } from './highlight-export'
import type { DocumentEntity } from '@/types/document'

function makeDoc(): DocumentEntity {
  const now = new Date().toISOString()
  return {
    id: 'd1', url: 'https://example.com/a', title: '文章', markdown: 'x',
    wordCount: 1, tokenCount: 1, contentHash: 'd1',
    extractionMethod: 'defuddle', source: 'library', capturedAt: now, updatedAt: now,
  } as DocumentEntity
}

function hl(id: string, offset: number, text: string, note?: string) {
  return { id, startOffset: offset, endOffset: offset + text.length, text, note, createdAt: '', updatedAt: '' }
}

describe('highlightsToMarkdown', () => {
  it('returns empty string when there are no highlights', () => {
    expect(highlightsToMarkdown(makeDoc())).toBe('')
  })

  it('renders header, ordered quotes, and notes', () => {
    const doc = makeDoc()
    doc.highlights = [
      hl('b', 20, '第二条'),
      hl('a', 5, '第一条', '重要'),
    ]
    const md = highlightsToMarkdown(doc)
    expect(md).toContain('# 文章 · 高亮')
    expect(md).toContain('共 2 条高亮')
    expect(md).toContain('https://example.com/a')
    // sorted by startOffset
    expect(md.indexOf('第一条')).toBeLessThan(md.indexOf('第二条'))
    expect(md).toContain('**笔记**：重要')
  })
})
