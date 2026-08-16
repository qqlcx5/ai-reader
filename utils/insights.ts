/**
 * Library insights — pure aggregation over documents + the review log.
 * Powers the Insights view: weekly activity, all-time stats, top tags/sites.
 */
import type { DocumentEntity } from '@/types/document'
import type { ReviewLog } from '@/utils/review-stats'

export interface Insights {
  /** Documents captured in the last 7 days. */
  weekCaptures: number
  /** Words captured in the last 7 days (CJK-aware counts). */
  weekWords: number
  /** All-time documents / words. */
  totalDocs: number
  totalWords: number
  /** Reviews in the last 7 days / all-time. */
  weekReviews: number
  totalReviews: number
  /** Longest consecutive review days ever. */
  bestStreak: number
  /** Capture counts per day, oldest first (14 days). */
  capturesByDay: Array<{ date: string; count: number }>
  /** Top tags by usage, capped. */
  topTags: Array<{ name: string; count: number }>
  /** Top sources (siteName or hostname) by captures, capped. */
  topSites: Array<{ name: string; count: number }>
}

const DAY = 86_400_000

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function computeInsights(
  docs: DocumentEntity[],
  reviewLog: ReviewLog,
  now: Date = new Date(),
): Insights {
  const weekAgo = now.getTime() - 7 * DAY

  let weekCaptures = 0
  let weekWords = 0
  let totalWords = 0
  const tagCounts = new Map<string, number>()
  const siteCounts = new Map<string, number>()

  for (const doc of docs) {
    const t = new Date(doc.capturedAt).getTime()
    totalWords += doc.wordCount ?? 0
    if (!Number.isNaN(t) && t >= weekAgo) {
      weekCaptures++
      weekWords += doc.wordCount ?? 0
    }
    for (const tag of doc.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
    const site = doc.siteName || hostname(doc.url)
    if (site) siteCounts.set(site, (siteCounts.get(site) ?? 0) + 1)
  }

  // Reviews: last-7-day sum, total, and the longest run of consecutive days.
  let weekReviews = 0
  let totalReviews = 0
  for (const [day, count] of Object.entries(reviewLog)) {
    totalReviews += count
    const t = new Date(`${day}T00:00:00Z`).getTime()
    if (!Number.isNaN(t) && t >= weekAgo) weekReviews += count
  }

  // Longest streak: walk sorted day keys.
  const days = Object.keys(reviewLog).filter((d) => (reviewLog[d] ?? 0) > 0).sort()
  let bestStreak = 0
  let run = 0
  let prev: number | null = null
  for (const day of days) {
    const t = new Date(`${day}T00:00:00Z`).getTime()
    if (prev != null && t - prev <= DAY * 1.5) run++
    else run = 1
    bestStreak = Math.max(bestStreak, run)
    prev = t
  }

  const capturesByDay: Array<{ date: string; count: number }> = []
  const byDay = new Map<string, number>()
  for (const doc of docs) {
    const key = (doc.capturedAt || '').slice(0, 10)
    if (key) byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY)
    const key = dateKey(d)
    capturesByDay.push({ date: key, count: byDay.get(key) ?? 0 })
  }

  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, n)

  return {
    weekCaptures,
    weekWords,
    totalDocs: docs.length,
    totalWords,
    weekReviews,
    totalReviews,
    bestStreak,
    capturesByDay,
    topTags: top(tagCounts, 8),
    topSites: top(siteCounts, 8),
  }
}
