import { describe, it, expect } from 'vitest'
import { parseAnkiTsv, dedupeAgainst } from './anki-import'

describe('parseAnkiTsv', () => {
  it('parses tab-separated rows and skips Anki headers', () => {
    const text = [
      '#separator:tab',
      '#html:true',
      '问题一\t答案一',
      'Q2\tA2<br>second line',
    ].join('\n')
    const { cards, skipped } = parseAnkiTsv(text)
    expect(cards).toHaveLength(2)
    expect(cards[0].front).toBe('问题一')
    expect(cards[0].back).toBe('答案一')
    expect(cards[0].source).toBe('manual')
    expect(cards[0].sm2.ease).toBe(2.5)
    expect(cards[1].back).toBe('A2\nsecond line')
    expect(skipped).toBe(0)
  })

  it('unescapes HTML entities', () => {
    const { cards } = parseAnkiTsv('a&lt;b&gt;c\t x &amp; y ')
    expect(cards[0].front).toBe('a<b>c')
    expect(cards[0].back).toBe('x & y')
  })

  it('skips rows without a back side and blank lines', () => {
    const { cards, skipped } = parseAnkiTsv('只有正面\n\nQ\tA')
    expect(cards).toHaveLength(1)
    expect(skipped).toBe(1)
  })

  it('dedupes identical fronts within the file (whitespace/case-insensitive)', () => {
    const { cards, skipped } = parseAnkiTsv('Q1\tA\nq 1\tB')
    expect(cards).toHaveLength(1)
    expect(cards[0].back).toBe('A')
    expect(skipped).toBe(1)
  })
})

describe('dedupeAgainst', () => {
  it('drops cards whose front already exists in the library', () => {
    const parsed = parseAnkiTsv('Q1\tA\nQ2\tB')
    const existing = [{ id: 'e', documentId: 'd', front: 'q1', back: 'old', source: 'manual', sm2: {} as any, createdAt: '', updatedAt: '' }]
    const fresh = dedupeAgainst(parsed.cards, existing as any)
    expect(fresh.map((c) => c.front)).toEqual(['Q2'])
  })
})
