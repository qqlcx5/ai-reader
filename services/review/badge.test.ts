import { describe, it, expect } from 'vitest'
import { formatBadgeCount } from './badge'

describe('formatBadgeCount', () => {
  it('hides the badge for zero/negative counts', () => {
    expect(formatBadgeCount(0)).toBe('')
    expect(formatBadgeCount(-3)).toBe('')
  })

  it('shows the plain number up to 99', () => {
    expect(formatBadgeCount(1)).toBe('1')
    expect(formatBadgeCount(42)).toBe('42')
    expect(formatBadgeCount(99)).toBe('99')
  })

  it('caps at 99+', () => {
    expect(formatBadgeCount(100)).toBe('99+')
    expect(formatBadgeCount(9999)).toBe('99+')
  })
})
