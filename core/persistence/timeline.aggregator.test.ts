/**
 * timeline.aggregator unit tests.
 *
 * Verifies the day / week / month bucketing for the
 * timeline UI and the stats summary.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../db/dexie'
import { documentRepository } from '@core/documents/document.repository'
import { chatRepository } from '@core/chat/chat.repository'
import {
  aggregateTimeline,
  getTimelineStats,
  getDocumentsForDay,
} from './timeline.aggregator'
import type { CapturedDocument } from '@db/schema'

function makeDoc(id: string, createdAt: number): CapturedDocument {
  return {
    id,
    url: `https://e.com/${id}`,
    title: `Doc ${id}`,
    markdownContent: '# x',
    createdAt,
    updatedAt: createdAt,
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await documentRepository.clear()
  await chatRepository.clear()
})

describe('aggregateTimeline', () => {
  it('groups by day', async () => {
    const day1 = new Date('2025-01-01T10:00:00').getTime()
    const day2 = new Date('2025-01-02T10:00:00').getTime()
    await documentRepository.bulkPut([
      makeDoc('a', day1),
      makeDoc('b', day1 + 1000),
      makeDoc('c', day2),
    ])

    const buckets = await aggregateTimeline({ granularity: 'day' })
    expect(buckets).toHaveLength(2)
    expect(buckets[0].count).toBe(1)
    expect(buckets[1].count).toBe(2)
    expect(buckets[0].key).toBe('2025-01-02')
    expect(buckets[1].key).toBe('2025-01-01')
  })

  it('groups by month', async () => {
    const jan = new Date('2025-01-15T10:00:00').getTime()
    const feb = new Date('2025-02-10T10:00:00').getTime()
    await documentRepository.bulkPut([
      makeDoc('a', jan),
      makeDoc('b', jan + 1000),
      makeDoc('c', feb),
    ])

    const buckets = await aggregateTimeline({ granularity: 'month' })
    expect(buckets).toHaveLength(2)
    expect(buckets[0].key).toBe('2025-02')
    expect(buckets[0].count).toBe(1)
    expect(buckets[1].key).toBe('2025-01')
    expect(buckets[1].count).toBe(2)
  })

  it('respects startAt / endAt range', async () => {
    const inside = new Date('2025-01-15').getTime()
    const outside = new Date('2024-12-01').getTime()
    await documentRepository.bulkPut([makeDoc('a', inside), makeDoc('b', outside)])

    const buckets = await aggregateTimeline({
      granularity: 'day',
      startAt: new Date('2025-01-01').getTime(),
      endAt: new Date('2025-02-01').getTime(),
    })
    expect(buckets).toHaveLength(1)
    expect(buckets[0].count).toBe(1)
  })

  it('caps per-bucket document list', async () => {
    const ts = new Date('2025-01-15T10:00:00').getTime()
    await documentRepository.bulkPut(
      Array.from({ length: 10 }, (_, i) => makeDoc(`d${i}`, ts + i * 1000))
    )
    const buckets = await aggregateTimeline({ granularity: 'day', perBucketLimit: 3 })
    expect(buckets[0].count).toBe(10)
    expect(buckets[0].documents).toHaveLength(3)
    // newest first
    expect(buckets[0].documents[0].id).toBe('d9')
  })

  it('returns an empty array when there is no data', async () => {
    const buckets = await aggregateTimeline({ granularity: 'day' })
    expect(buckets).toEqual([])
  })
})

describe('getTimelineStats', () => {
  it('reports zero stats on empty store', async () => {
    const s = await getTimelineStats()
    expect(s.totalDocuments).toBe(0)
    expect(s.hottestDay).toBeNull()
    expect(s.recentCount).toBe(0)
  })

  it('counts recent and identifies the hottest day', async () => {
    const dayA = new Date('2025-01-15T10:00:00').getTime()
    const dayB = new Date('2025-01-16T10:00:00').getTime()
    const recentDay = Date.now() - 2 * 86_400_000 // 2 days ago
    await documentRepository.bulkPut([
      makeDoc('a', dayA),
      makeDoc('b', dayA + 1000),
      makeDoc('c', dayA + 2000),
      makeDoc('d', dayB),
      makeDoc('e', recentDay),
    ])
    const s = await getTimelineStats()
    expect(s.totalDocuments).toBe(5)
    expect(s.recentCount).toBeGreaterThanOrEqual(1)
    expect(['2025-01-15', '2025-01-16']).toContain(s.hottestDay)
    // 3 docs on dayA vs 1 on dayB → dayA is hottest
    expect(s.hottestDay).toBe('2025-01-15')
  })
})

describe('getDocumentsForDay', () => {
  it('returns the docs for a specific ISO day', async () => {
    const day = new Date('2025-01-15T10:00:00').getTime()
    await documentRepository.bulkPut([makeDoc('a', day), makeDoc('b', day + 1000)])
    const list = await getDocumentsForDay('2025-01-15')
    expect(list).toHaveLength(2)
    expect(list[0].id).toBe('b') // newest first
  })

  it('returns an empty array for a day with nothing', async () => {
    const list = await getDocumentsForDay('2099-12-31')
    expect(list).toEqual([])
  })
})
