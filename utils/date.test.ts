import { describe, it, expect } from 'vitest'
import { formatDate, formatRelative, nowISO } from './date'

describe('utils/date', () => {
  it('should format date with default format', () => {
    const result = formatDate('2024-06-15T10:30:00Z')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('should format date with custom format', () => {
    const result = formatDate('2024-06-15T10:30:00Z', 'YYYY/MM/DD')
    expect(result).toBe('2024/06/15')
  })

  it('should return relative time for recent dates', () => {
    const now = new Date()
    const oneMinAgo = new Date(now.getTime() - 60 * 1000).toISOString()
    const result = formatRelative(oneMinAgo)
    expect(result).toMatch(/刚刚|1分钟前/)
  })

  it('should return ISO string from nowISO', () => {
    const result = nowISO()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
