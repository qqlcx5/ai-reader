import { describe, it, expect } from 'vitest'
import { computeHealth, healthScore } from './health'
import type { DocumentEntity } from '@/types/document'

const NOW = new Date('2025-06-15T12:00:00.000Z')

function doc(id: string, overrides: Partial<DocumentEntity> = {}): DocumentEntity {
  const capturedAt = overrides.capturedAt ?? '2025-06-10T00:00:00Z'
  return {
    id, url: `https://example.com/${id}`, title: `标题 ${id}`, markdown: '正文',
    wordCount: 500, tokenCount: 500, contentHash: id,
    extractionMethod: 'defuddle', source: 'library', capturedAt, updatedAt: capturedAt,
    ...overrides,
  } as DocumentEntity
}

describe('computeHealth', () => {
  it('detects stub docs, untagged, and 30-day backlog', () => {
    const report = computeHealth([
      doc('ok', { tags: ['a'] }),
      doc('stub', { wordCount: 10 }),
      doc('untagged'),
      doc('old', { capturedAt: '2025-04-01T00:00:00Z' }), // never opened, 75d
      doc('old-opened', { capturedAt: '2025-04-01T00:00:00Z', lastOpenedAt: '2025-06-01T00:00:00Z' }),
    ], NOW)
    expect(report.stubDocs.map((d) => d.id)).toEqual(['stub'])
    expect(report.untagged.map((d) => d.id)).toContain('untagged')
    expect(report.backlog.map((d) => d.id)).toEqual(['old'])
    expect(report.totalDocs).toBe(5)
  })

  it('pairs near-duplicates by title lead or excerpt head', () => {
    const report = computeHealth([
      doc('a', { title: '深度学习 入门指南', markdown: '内容A', excerpt: '同样的摘录开头' }),
      doc('b', { title: '深度学习 入门指南（转载）', markdown: '内容B', excerpt: '同样的摘录开头' }),
      doc('c', { title: '完全不同', markdown: '内容C' }),
    ], NOW)
    expect(report.nearDuplicates).toHaveLength(1)
    expect(report.nearDuplicates[0].a.id).toBe('a')
    expect(report.nearDuplicates[0].b.id).toBe('b')
  })

  it('finds highlights whose offsets exceed the markdown', () => {
    const broken = doc('h', {
      markdown: '短文',
      highlights: [{ id: 'x', startOffset: 0, endOffset: 999, text: '漂移', createdAt: '', updatedAt: '' } as any],
    })
    const ok = doc('h2', {
      markdown: '这是一段足够长的正文内容',
      highlights: [{ id: 'y', startOffset: 0, endOffset: 5, text: '这是一', createdAt: '', updatedAt: '' } as any],
    })
    const report = computeHealth([broken, ok], NOW)
    expect(report.brokenHighlights).toHaveLength(1)
    expect(report.brokenHighlights[0].count).toBe(1)
  })

  it('excludes digest documents from all checks', () => {
    const report = computeHealth([doc('d', { wordCount: 10, tags: ['digest'] })], NOW)
    expect(report.totalDocs).toBe(0)
    expect(report.stubDocs).toHaveLength(0)
  })
})

describe('healthScore', () => {
  it('scores a clean library 100 and degrades with problems', () => {
    const clean = computeHealth([doc('a', { tags: ['x'] }), doc('b', { tags: ['x'] })], NOW)
    expect(healthScore(clean).score).toBeGreaterThanOrEqual(85)

    const messy = computeHealth([doc('s1', { wordCount: 1 }), doc('s2', { wordCount: 1 })], NOW)
    expect(healthScore(messy).score).toBeLessThan(60)
  })
})
