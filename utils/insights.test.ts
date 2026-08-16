import { describe, it, expect } from 'vitest'
import { computeInsights } from './insights'
import type { DocumentEntity } from '@/types/document'

const NOW = new Date('2025-06-15T12:00:00.000Z')

function doc(id: string, capturedAt: string, tags: string[] = [], siteName?: string, wordCount = 100): DocumentEntity {
  return {
    id, url: `https://www.${siteName || 'example.com'}/a`, title: id,
    markdown: 'x', wordCount, tokenCount: wordCount, contentHash: id,
    extractionMethod: 'defuddle', source: 'library', capturedAt, updatedAt: capturedAt,
    tags, siteName,
  } as DocumentEntity
}

describe('computeInsights', () => {
  it('aggregates weekly and all-time numbers', () => {
    const docs = [
      doc('a', '2025-06-14T00:00:00Z', ['AI']),      // within 7d
      doc('b', '2025-06-10T00:00:00Z', ['AI', '教程']), // within 7d
      doc('c', '2025-05-01T00:00:00Z', ['Rust']),     // old
    ]
    const reviewLog = {
      '2025-06-14': 10, // within 7d
      '2025-06-13': 5,  // within 7d
      '2025-05-02': 3,
    }
    const s = computeInsights(docs, reviewLog, NOW)
    expect(s.weekCaptures).toBe(2)
    expect(s.weekWords).toBe(200)
    expect(s.totalDocs).toBe(3)
    expect(s.totalWords).toBe(300)
    expect(s.weekReviews).toBe(15)
    expect(s.totalReviews).toBe(18)
  })

  it('computes the longest review streak across gaps', () => {
    const reviewLog = { '2025-06-01': 1, '2025-06-02': 1, '2025-06-03': 1, '2025-06-10': 1, '2025-06-11': 1 }
    const s = computeInsights([], reviewLog, NOW)
    expect(s.bestStreak).toBe(3)
  })

  it('builds a 14-day capture series with zero-filled days', () => {
    const docs = [doc('a', '2025-06-14T00:00:00Z'), doc('b', '2025-06-14T01:00:00Z'), doc('c', '2025-06-02T00:00:00Z')]
    const s = computeInsights(docs, {}, NOW)
    expect(s.capturesByDay).toHaveLength(14)
    expect(s.capturesByDay[0].date).toBe('2025-06-02')
    expect(s.capturesByDay.find((d) => d.date === '2025-06-14')?.count).toBe(2)
    expect(s.capturesByDay.find((d) => d.date === '2025-06-15')?.count).toBe(0)
    expect(s.capturesByDay.find((d) => d.date === '2025-06-02')?.count).toBe(1)
  })

  it('ranks top tags and sites (siteName beats hostname, www stripped)', () => {
    const docs = [
      doc('a', '2025-06-14T00:00:00Z', ['AI'], '机器之心'),
      doc('b', '2025-06-14T00:00:00Z', ['AI'], '机器之心'),
      doc('c', '2025-06-14T00:00:00Z', ['Rust'], undefined),
    ]
    const s = computeInsights(docs, {}, NOW)
    expect(s.topTags[0]).toEqual({ name: 'AI', count: 2 })
    expect(s.topTags).toHaveLength(2)
    expect(s.topSites[0].name).toBe('机器之心')
    expect(s.topSites.map((x) => x.name)).toContain('example.com')
  })

  it('handles empty inputs', () => {
    const s = computeInsights([], {}, NOW)
    expect(s.totalDocs).toBe(0)
    expect(s.bestStreak).toBe(0)
    expect(s.capturesByDay).toHaveLength(14)
  })
})
