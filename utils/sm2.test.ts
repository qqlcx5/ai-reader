import { describe, it, expect } from 'vitest'
import {
  initialSm2State,
  schedule,
  previewIntervalDays,
  isDue,
  GRADE_TO_QUALITY,
  type Sm2State,
} from './sm2'

const NOW = new Date('2025-01-01T00:00:00.000Z')

function reviewed(grade: Parameters<typeof schedule>[1], state?: Sm2State): Sm2State {
  return schedule(state ?? initialSm2State(NOW), grade, NOW)
}

describe('initialSm2State', () => {
  it('starts immediately due with default ease', () => {
    const s = initialSm2State(NOW)
    expect(s.ease).toBe(2.5)
    expect(s.reps).toBe(0)
    expect(isDue(s, NOW)).toBe(true)
  })
})

describe('schedule', () => {
  it('first good review → 1 day interval', () => {
    const s = reviewed('good')
    expect(s.reps).toBe(1)
    expect(s.intervalDays).toBe(1)
    expect(s.dueAt).toBe('2025-01-02T00:00:00.000Z')
    expect(s.lastReviewedAt).toBe(NOW.toISOString())
  })

  it('second good review → 6 day interval', () => {
    const s = reviewed('good', reviewed('good'))
    expect(s.reps).toBe(2)
    expect(s.intervalDays).toBe(6)
  })

  it('third good review multiplies interval by ease', () => {
    const s = reviewed('good', reviewed('good', reviewed('good')))
    expect(s.reps).toBe(3)
    expect(s.intervalDays).toBe(Math.round(6 * s.ease))
  })

  it('easy raises ease; hard lowers it', () => {
    const easy = reviewed('easy')
    const hard = reviewed('hard')
    expect(easy.ease).toBeGreaterThan(2.5)
    expect(hard.ease).toBeLessThan(2.5)
  })

  it('ease never drops below 1.3', () => {
    let s = initialSm2State(NOW)
    for (let i = 0; i < 20; i++) s = schedule(s, 'hard', NOW)
    expect(s.ease).toBeGreaterThanOrEqual(1.3)
  })

  it('again resets streak, counts a lapse, and is due immediately', () => {
    let s = reviewed('good', reviewed('good'))
    s = schedule(s, 'again', NOW)
    expect(s.reps).toBe(0)
    expect(s.lapses).toBe(1)
    expect(s.intervalDays).toBe(1)
    expect(isDue(s, NOW)).toBe(true)
  })

  it('ease is unchanged on a failed review', () => {
    let s = reviewed('easy') // ease > 2.5
    const easeBefore = s.ease
    s = schedule(s, 'again', NOW)
    expect(s.ease).toBe(easeBefore)
  })
})

describe('previewIntervalDays', () => {
  it('matches the interval schedule() will produce', () => {
    let s = initialSm2State(NOW)
    for (const grade of ['again', 'hard', 'good', 'easy'] as const) {
      expect(previewIntervalDays(s, grade)).toBe(schedule(s, grade, NOW).intervalDays)
      s = schedule(s, 'good', NOW)
      expect(previewIntervalDays(s, grade)).toBe(schedule(s, grade, NOW).intervalDays)
    }
  })
})

describe('GRADE_TO_QUALITY', () => {
  it('maps the four buttons onto SM-2 qualities', () => {
    expect(GRADE_TO_QUALITY).toEqual({ again: 2, hard: 3, good: 4, easy: 5 })
  })
})
