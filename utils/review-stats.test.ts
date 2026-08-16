import { describe, it, expect } from 'vitest'
import { computeReviewStats, recordReview, applyNewCardLimit, lastNDays } from './review-stats'

const d = (s: string) => new Date(`${s}T12:00:00.000Z`)

describe('lastNDays', () => {
  it('returns n days oldest-first with zero-filled gaps', () => {
    const today = d('2025-01-10')
    const series = lastNDays({ '2025-01-09': 3, '2025-01-10': 7 }, 3, today)
    expect(series.map((x) => x.date)).toEqual(['2025-01-08', '2025-01-09', '2025-01-10'])
    expect(series.map((x) => x.count)).toEqual([0, 3, 7])
  })
})

describe('applyNewCardLimit', () => {
  const card = (id: string, reps: number, createdAt: string) =>
    ({ id, sm2: { reps }, createdAt } as any)

  it('is a no-op when limit <= 0', () => {
    const due = [card('n1', 0, '2025-02-01'), card('n2', 0, '2025-02-02')]
    expect(applyNewCardLimit(due, 0, 5)).toBe(due)
    expect(applyNewCardLimit(due, -1, 0)).toBe(due)
  })

  it('puts review cards first, then oldest new cards up to the remaining quota', () => {
    const due = [
      card('n-newer', 0, '2025-02-03'),
      card('r1', 3, '2025-01-01'),
      card('n-older', 0, '2025-02-02'),
    ]
    const queue = applyNewCardLimit(due, 2, 1) // 1 quota left
    expect(queue.map((c) => c.id)).toEqual(['r1', 'n-older'])
  })

  it('drops all new cards when the daily quota is exhausted', () => {
    const due = [card('r', 1, 'x'), card('n', 0, 'y')]
    expect(applyNewCardLimit(due, 5, 5).map((c) => c.id)).toEqual(['r'])
  })
})

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
