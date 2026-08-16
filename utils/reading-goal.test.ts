import { describe, it, expect } from 'vitest'
import { computeReadingGoal, wordsByDay } from './reading-goal'
import type { DocumentEntity } from '@/types/document'

const NOW = new Date('2025-06-15T12:00:00.000Z')

function doc(id: string, capturedAt: string, words: number): DocumentEntity {
  return {
    id, url: `https://example.com/${id}`, title: id, markdown: 'x',
    wordCount: words, tokenCount: words, contentHash: id,
    extractionMethod: 'defuddle', source: 'library', capturedAt, updatedAt: capturedAt,
  } as DocumentEntity
}

describe('wordsByDay', () => {
  it('aggregates word counts per calendar day', () => {
    const map = wordsByDay([
      doc('a', '2025-06-15T01:00:00Z', 100),
      doc('b', '2025-06-15T05:00:00Z', 200),
      doc('c', '2025-06-14T01:00:00Z', 50),
    ])
    expect(map.get('2025-06-15')).toBe(300)
    expect(map.get('2025-06-14')).toBe(50)
    expect(map.size).toBe(2)
  })
})

describe('computeReadingGoal', () => {
  it('computes today progress capped at 1', () => {
    const s = computeReadingGoal([doc('a', '2025-06-15T01:00:00Z', 3000)], 5000, NOW)
    expect(s).toMatchObject({ todayWords: 3000, goal: 5000, progress: 0.6, streak: 0 })
  })

  it('counts goal streak with yesterday grace', () => {
    const docs = [
      doc('a', '2025-06-15T01:00:00Z', 6000), // today met
      doc('b', '2025-06-14T01:00:00Z', 5500),
      doc('c', '2025-06-13T01:00:00Z', 5200),
      doc('d', '2025-06-12T01:00:00Z', 100), // gap
    ]
    expect(computeReadingGoal(docs, 5000, NOW).streak).toBe(3)

    // Today not met yet → streak still counts through yesterday.
    const partial = computeReadingGoal(docs.slice(1), 5000, NOW)
    expect(partial.todayWords).toBe(0)
    expect(partial.streak).toBe(2)
  })

  it('handles zero goals and empty libraries', () => {
    const s = computeReadingGoal([], 0, NOW)
    expect(s.progress).toBe(0)
    expect(s.streak).toBe(0)
  })
})
