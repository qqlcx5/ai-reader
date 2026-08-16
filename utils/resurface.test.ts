import { describe, it, expect } from 'vitest'
import { pickResurfaceDoc, hashString, RESURFACE_MIN_AGE_DAYS } from './resurface'
import type { DocumentEntity } from '@/types/document'

const TODAY = new Date('2025-06-15T00:00:00.000Z')

function makeDoc(id: string, capturedAt: string): DocumentEntity {
  return {
    id, url: `https://example.com/${id}`, title: `文档 ${id}`, markdown: 'x',
    wordCount: 1, tokenCount: 1, contentHash: id,
    extractionMethod: 'defuddle', source: 'library', capturedAt, updatedAt: capturedAt,
  } as DocumentEntity
}

function daysAgo(n: number): string {
  return new Date(TODAY.getTime() - n * 86_400_000).toISOString()
}

describe('hashString', () => {
  it('is deterministic and differs across inputs', () => {
    expect(hashString('2025-06-15')).toBe(hashString('2025-06-15'))
    expect(hashString('2025-06-15')).not.toBe(hashString('2025-06-16'))
  })
})

describe('pickResurfaceDoc', () => {
  it('only considers documents at least 30 days old', () => {
    const docs = [makeDoc('old', daysAgo(RESURFACE_MIN_AGE_DAYS)), makeDoc('new', daysAgo(10))]
    expect(pickResurfaceDoc(docs, TODAY)?.id).toBe('old')
  })

  it('returns null when nothing is old enough', () => {
    expect(pickResurfaceDoc([makeDoc('a', daysAgo(5))], TODAY)).toBeNull()
    expect(pickResurfaceDoc([], TODAY)).toBeNull()
  })

  it('is deterministic for the same day and rotates across days', () => {
    const docs = Array.from({ length: 12 }, (_, i) => makeDoc(`d${i}`, daysAgo(60 + i)))
    const d1 = pickResurfaceDoc(docs, TODAY)
    const d1again = pickResurfaceDoc(docs, TODAY)
    expect(d1?.id).toBe(d1again?.id)

    // Across 40 days, more than one distinct document gets picked.
    const picked = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const day = new Date(TODAY.getTime() + i * 86_400_000)
      const doc = pickResurfaceDoc(docs, day)
      if (doc) picked.add(doc.id)
    }
    expect(picked.size).toBeGreaterThan(1)
  })

  it('ignores documents with invalid dates', () => {
    const docs = [makeDoc('bad', 'not-a-date'), makeDoc('good', daysAgo(100))]
    expect(pickResurfaceDoc(docs, TODAY)?.id).toBe('good')
  })
})
