import { describe, it, expect } from 'vitest'
import { parseCron, cronMatches, cronExprMatchesNow } from './cron'

describe('cron parser', () => {
  it('parses */n step in minute field', () => {
    const p = parseCron('*/15 * * * *')
    expect([...p.minute].sort((a, b) => a - b)).toEqual([0, 15, 30, 45])
  })

  it('parses a list with a range', () => {
    const p = parseCron('0,30 9-17 * * 1-5')
    expect([...p.minute]).toEqual([0, 30])
    expect([...p.hour].sort((a, b) => a - b)).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17])
    expect([...p.dow].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
  })

  it('normalizes Sunday=7 to 0 in dow', () => {
    const p = parseCron('0 0 * * 7')
    expect(p.dow.has(0)).toBe(true)
    expect(p.dow.has(7)).toBe(false)
  })

  it('matches a specific time exactly', () => {
    const p = parseCron('30 23 * * *')
    expect(cronMatches(p, new Date('2026-07-21T23:30:00'))).toBe(true)
    expect(cronMatches(p, new Date('2026-07-21T23:31:00'))).toBe(false)
    expect(cronMatches(p, new Date('2026-07-21T22:30:00'))).toBe(false)
  })

  it('matches weekday-only schedule', () => {
    const p = parseCron('0 9 * * 1-5')
    // Monday 2026-07-20
    expect(cronMatches(p, new Date('2026-07-20T09:00:00'))).toBe(true)
    // Sunday 2026-07-19
    expect(cronMatches(p, new Date('2026-07-19T09:00:00'))).toBe(false)
  })

  it('rejects malformed expressions', () => {
    expect(() => parseCron('* * *')).toThrow(/5 fields/)
    expect(() => parseCron('abc * * * *')).toThrow(/Invalid cron field/)
    expect(() => parseCron('*/0 * * * *')).toThrow(/Invalid step/)
  })

  it('cronExprMatchesNow convenience works', () => {
    const now = new Date('2026-07-21T23:00:00')
    expect(cronExprMatchesNow('0 23 * * *', now)).toBe(true)
    expect(cronExprMatchesNow('0 22 * * *', now)).toBe(false)
  })
})
