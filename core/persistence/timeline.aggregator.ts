/**
 * Timeline aggregation helpers.
 *
 * The Persistence layer is the only place that owns the
 * `documentRepository`, so any time-bucketing that the
 * Timeline module needs should go through here.  We
 * deliberately keep this dependency-inverted: the aggregator
 * pulls documents and emits aggregates; the UI is free to
 * pick the granularity (`day` / `week` / `month`).
 *
 * The output shape (`TimelineBucket`) is intentionally
 * minimal — just enough to drive a contribution graph or a
 * daily list.  Document titles / ids are included so the
 * caller can drill in without a second round-trip.
 */

import { documentRepository } from '@core/documents/document.repository'
import type { CapturedDocument, DocumentMetadata } from '@db/schema'

export type TimelineGranularity = 'day' | 'week' | 'month'

export interface TimelineBucket {
  /** ISO date string (`YYYY-MM-DD` for day, `YYYY-Www` for week, `YYYY-MM` for month). */
  key: string
  /** Human-readable label, useful in UI without re-formatting. */
  label: string
  /** First millisecond of the bucket (inclusive). */
  startAt: number
  /** First millisecond of the *next* bucket (exclusive). */
  endAt: number
  /** Number of documents captured in this bucket. */
  count: number
  /** Lightweight doc metadata for the bucket (newest first). */
  documents: DocumentMetadata[]
}

export interface TimelineQuery {
  granularity: TimelineGranularity
  /** Inclusive start. Defaults to "all time" (0). */
  startAt?: number
  /** Exclusive end. Defaults to "now". */
  endAt?: number
  /** How many docs to keep per bucket in the returned list. */
  perBucketLimit?: number
}

/* ------------------------------------------------------------------ */
/*  Bucket key generation                                              */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function isoDay(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function isoWeek(timestamp: number): { key: string; monday: number } {
  // ISO-8601 week number, with the week starting on Monday.
  const d = new Date(timestamp)
  // Day of week: 0 = Sun, 1 = Mon, … 6 = Sat
  const day = d.getDay() || 7
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1))
  // Find the Thursday of that week to compute the ISO year/week.
  const thursday = new Date(monday)
  thursday.setDate(monday.getDate() + 3)
  const year = thursday.getFullYear()
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const jan4Monday = new Date(year, 0, 4 - (jan4Day - 1))
  const week =
    1 + Math.floor((monday.getTime() - jan4Monday.getTime()) / WEEK_MS)
  return { key: `${year}-W${pad2(week)}`, monday: monday.getTime() }
}

function isoMonth(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function bucketOf(
  doc: CapturedDocument,
  granularity: TimelineGranularity
): { key: string; label: string; startAt: number; endAt: number } {
  const ts = doc.createdAt
  if (granularity === 'day') {
    const start = new Date(ts)
    start.setHours(0, 0, 0, 0)
    const end = start.getTime() + DAY_MS
    return {
      key: isoDay(start.getTime()),
      label: isoDay(start.getTime()),
      startAt: start.getTime(),
      endAt: end,
    }
  }
  if (granularity === 'week') {
    const { key, monday } = isoWeek(ts)
    return {
      key,
      label: key,
      startAt: monday,
      endAt: monday + WEEK_MS,
    }
  }
  // month
  const d = new Date(ts)
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
  return { key: isoMonth(ts), label: isoMonth(ts), startAt: start, endAt: end }
}

function toMetadata(doc: CapturedDocument): DocumentMetadata {
  return {
    id: doc.id,
    url: doc.url,
    title: doc.title,
    description: doc.description,
    author: doc.author,
    publishedAt: doc.publishedAt,
    siteName: doc.siteName,
    favicon: doc.favicon,
    image: doc.image,
    wordCount: doc.wordCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Aggregate documents into time buckets.
 *
 * `perBucketLimit` defaults to 5 so a year-long monthly view
 * doesn't drag the entire corpus into the response.  Pass
 * `undefined` to disable the cap.
 */
export async function aggregateTimeline(
  query: TimelineQuery
): Promise<TimelineBucket[]> {
  const {
    granularity,
    startAt = 0,
    endAt = Date.now(),
    perBucketLimit = 5,
  } = query

  const docs = await documentRepository.listAll()
  const inRange = docs.filter((d) => d.createdAt >= startAt && d.createdAt < endAt)

  const buckets = new Map<string, TimelineBucket>()
  for (const doc of inRange) {
    const slot = bucketOf(doc, granularity)
    let bucket = buckets.get(slot.key)
    if (!bucket) {
      bucket = {
        key: slot.key,
        label: slot.label,
        startAt: slot.startAt,
        endAt: slot.endAt,
        count: 0,
        documents: [],
      }
      buckets.set(slot.key, bucket)
    }
    bucket.count += 1
    if (perBucketLimit === undefined || bucket.documents.length < perBucketLimit) {
      bucket.documents.push(toMetadata(doc))
    }
  }

  // Sort newest first, documents within each bucket newest first.
  return Array.from(buckets.values())
    .sort((a, b) => b.startAt - a.startAt)
    .map((b) => ({ ...b, documents: sortByCreatedDesc(b.documents) }))
}

function sortByCreatedDesc(arr: DocumentMetadata[]): DocumentMetadata[] {
  return arr.slice().sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * A quick stats summary for the Settings page header.
 */
export interface TimelineStats {
  totalDocuments: number
  totalChats: number
  /** Documents captured in the last 7 days. */
  recentCount: number
  /** ISO day with the most captures (or null when empty). */
  hottestDay: string | null
  /** First capture timestamp (or 0 if none). */
  firstCapturedAt: number
  /** Last capture timestamp (or 0 if none). */
  lastCapturedAt: number
}

export async function getTimelineStats(): Promise<TimelineStats> {
  const docs = await documentRepository.listAll()
  if (docs.length === 0) {
    return {
      totalDocuments: 0,
      totalChats: 0,
      recentCount: 0,
      hottestDay: null,
      firstCapturedAt: 0,
      lastCapturedAt: 0,
    }
  }
  const dayCounts = new Map<string, number>()
  let recent = 0
  const cutoff = Date.now() - 7 * DAY_MS
  let first = Number.POSITIVE_INFINITY
  let last = 0
  for (const d of docs) {
    const k = isoDay(d.createdAt)
    dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1)
    if (d.createdAt >= cutoff) recent += 1
    if (d.createdAt < first) first = d.createdAt
    if (d.createdAt > last) last = d.createdAt
  }
  let hottest: { key: string; count: number } | null = null
  for (const [k, c] of dayCounts) {
    if (!hottest || c > hottest.count) hottest = { key: k, count: c }
  }
  // Lazy import to avoid a circular reference with the chat
  // module (the chat store reaches into documents, and we
  // don't want it reaching back).
  const { chatRepository } = await import('@core/chat/chat.repository')
  const totalChats = await chatRepository.count().catch(() => 0)
  return {
    totalDocuments: docs.length,
    totalChats,
    recentCount: recent,
    hottestDay: hottest?.key ?? null,
    firstCapturedAt: first,
    lastCapturedAt: last,
  }
}

/**
 * For a given ISO day (`YYYY-MM-DD`), return the documents
 * captured that day.  Convenience for the Timeline UI's
 * "click a day to see what was captured" drilldown.
 */
export async function getDocumentsForDay(isoDayKey: string): Promise<DocumentMetadata[]> {
  const docs = await documentRepository.listAll()
  return docs
    .filter((d) => isoDay(d.createdAt) === isoDayKey)
    .map(toMetadata)
    .sort((a, b) => b.createdAt - a.createdAt)
}
