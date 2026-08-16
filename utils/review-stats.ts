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

/**
 * Last n days as a heatmap series, oldest first. Days with no reviews
 * carry count 0 (rendered as empty cells).
 */
export function lastNDays(log: ReviewLog, n: number, today: Date = new Date()): Array<{ date: string; count: number }> {
  const out: Array<{ date: string; count: number }> = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = dateKey(d)
    out.push({ date: key, count: log[key] ?? 0 })
  }
  return out
}

/** True when a card has never been successfully reviewed. */
export function isNewCard(card: { sm2: { reps: number } }): boolean {
  return (card.sm2.reps ?? 0) === 0
}

/**
 * Apply the daily new-card cap to a due queue: review cards first, then up to
 * (limit − already used today) new cards, oldest created first. limit <= 0
 * disables the cap.
 */
export function applyNewCardLimit<T extends { sm2: { reps: number }; createdAt: string }>(
  due: T[],
  limit: number,
  usedToday: number,
): T[] {
  if (limit <= 0) return due
  const reviewCards = due.filter((c) => !isNewCard(c))
  const newCards = due
    .filter(isNewCard)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return [...reviewCards, ...newCards.slice(0, Math.max(0, limit - usedToday))]
}
