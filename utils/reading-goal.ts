/**
 * Daily reading goal — words captured/read per day, tracked from the
 * documents' capturedAt+wordCount. Progress ring in the library header.
 */
import type { DocumentEntity } from '@/types/document'

export const DEFAULT_GOAL_WORDS = 5000

export interface ReadingGoalStats {
  /** Words captured today. */
  todayWords: number
  /** Configured daily goal. */
  goal: number
  /** 0–1 progress, capped. */
  progress: number
  /** Days (ending today) that met the goal. */
  streak: number
}

/** Count words captured per calendar day from documents (pure). */
export function wordsByDay(docs: DocumentEntity[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const doc of docs) {
    const key = (doc.capturedAt || '').slice(0, 10)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + (doc.wordCount ?? 0))
  }
  return map
}

export function computeReadingGoal(
  docs: DocumentEntity[],
  goal: number,
  now: Date = new Date(),
): ReadingGoalStats {
  const byDay = wordsByDay(docs)
  const keyOf = (d: Date) => d.toISOString().slice(0, 10)
  const todayWords = byDay.get(keyOf(now)) ?? 0

  // Goal streak counts back from today (today counts only when already met —
  // same grace rule as review streaks).
  let streak = 0
  const cursor = new Date(now)
  if (todayWords < goal) cursor.setDate(cursor.getDate() - 1)
  while ((byDay.get(keyOf(cursor)) ?? 0) >= goal && goal > 0) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return {
    todayWords,
    goal,
    progress: goal > 0 ? Math.min(1, todayWords / goal) : 0,
    streak,
  }
}
