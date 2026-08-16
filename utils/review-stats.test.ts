import { describe, it, expect } from 'vitest'
import { computeReviewStats, recordReview } from './review-stats'

const d = (s: string) => new Date(`${s}T12:00:00.000Z`)

describe('recordReview', () => {
  it('increments today and keeps other days', () => {
    const log = recordReview({ '2025-01-01': 3 }, d('2025-01-02'))
    expect(log).toEqual({ '2025-01-01': 3, '2025-01-02': 1 })
    expect(recordReview(log, d('2025-01-02'))['2025-01-02']).toBe(2)
  })
})

describe('computeReviewStats', () => {
  it('sums totals and counts today', () => {
    const s = computeReviewStats({ '2025-01-01': 2, '2025-01-02': 5 }, d('2025-01-02'))
    expect(s).toEqual({ total: 7, streak: 2, today: 5 })
  })

  it('keeps yesterday streak alive when today has no reviews yet', () => {
    const s = computeReviewStats({ '2025-01-01': 2 }, d('2025-01-02'))
    expect(s.streak).toBe(1)
    expect(s.today).toBe(0)
  })

  it('breaks the streak after a full empty day', () => {
    const s = computeReviewStats({ '2025-01-01': 2 }, d('2025-01-03'))
    expect(s.streak).toBe(0)
  })

  it('handles an empty log', () => {
    expect(computeReviewStats({}, d('2025-01-01'))).toEqual({ total: 0, streak: 0, today: 0 })
  })
})
