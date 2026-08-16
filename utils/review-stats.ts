/**
 * Review history stats — a local { 'YYYY-MM-DD': count } log in kvMeta.
 * Streak counts consecutive days with at least one graded card; it survives
 * until the end of the day (a day with no reviews yet doesn't break it).
 */
import { dateKey } from '@/utils/date'

export type ReviewLog = Record<string, number>

export interface ReviewStats {
  /** Total cards graded all-time. */
  total: number
  /** Consecutive days with reviews, ending today or yesterday. */
  streak: number
  /** Graded today. */
  today: number
}

export function computeReviewStats(log: ReviewLog, today: Date = new Date()): ReviewStats {
  const total = Object.values(log).reduce((s, n) => s + n, 0)

  const keyOf = (d: Date) => dateKey(d)
  let todayCount = log[keyOf(today)] ?? 0

  // Walk back from today; skip today itself if it has no reviews yet
  // (yesterday's streak is still alive until midnight).
  let streak = 0
  let cursor = new Date(today)
  if (todayCount === 0) cursor.setDate(cursor.getDate() - 1)
  while ((log[keyOf(cursor)] ?? 0) > 0) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return { total, streak, today: todayCount }
}

/** Immutable log update for one graded card. */
export function recordReview(log: ReviewLog, today: Date = new Date()): ReviewLog {
  const key = dateKey(today)
  return { ...log, [key]: (log[key] ?? 0) + 1 }
}
