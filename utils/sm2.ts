/**
 * Classic SM-2 spaced repetition (Piotr Wozniak, 1987).
 *
 * Quality scores are the original 0–5 scale; the UI exposes a simplified
 * four-button grade mapped onto it:
 *   again → 2, hard → 3, good → 4, easy → 5
 */

/** Original SM-2 answer quality. */
export type Sm2Quality = 0 | 1 | 2 | 3 | 4 | 5

/** Four-button review grade. */
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy'

export const GRADE_TO_QUALITY: Record<ReviewGrade, Sm2Quality> = {
  again: 2,
  hard: 3,
  good: 4,
  easy: 5,
}

export interface Sm2State {
  /** Ease factor, clamped to >= 1.3. */
  ease: number
  /** Current inter-repetition interval in days (0 = never reviewed). */
  intervalDays: number
  /** Consecutive successful (q >= 3) reviews. */
  reps: number
  /** Times the card was failed (q < 3). */
  lapses: number
  /** ISO timestamp of the next scheduled review. */
  dueAt: string
  /** ISO timestamp of the last review, if any. */
  lastReviewedAt?: string
}

const DAY_MS = 86_400_000

export function initialSm2State(now: Date = new Date()): Sm2State {
  return {
    ease: 2.5,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    dueAt: now.toISOString(),
  }
}

function nextEase(ease: number, q: Sm2Quality): number {
  return Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
}

/**
 * The interval (in days) a grade would produce, without computing dates.
 * Used for button previews in the review UI.
 */
export function previewIntervalDays(state: Sm2State, grade: ReviewGrade): number {
  const q = GRADE_TO_QUALITY[grade]
  if (q < 3) return 1
  const reps = state.reps + 1
  if (reps === 1) return 1
  if (reps === 2) return 6
  return Math.max(1, Math.round(state.intervalDays * nextEase(state.ease, q)))
}

/**
 * Apply a review grade and return the next scheduling state.
 * Failed cards are due again immediately (dueAt = now).
 */
export function schedule(state: Sm2State, grade: ReviewGrade, now: Date = new Date()): Sm2State {
  const q = GRADE_TO_QUALITY[grade]
  let { ease, intervalDays, reps, lapses } = state

  if (q >= 3) {
    reps += 1
    ease = nextEase(ease, q)
    if (reps === 1) intervalDays = 1
    else if (reps === 2) intervalDays = 6
    else intervalDays = Math.round(intervalDays * ease)
  } else {
    lapses += 1
    reps = 0
    intervalDays = 1
  }

  const dueAt = q < 3 ? now.getTime() : now.getTime() + intervalDays * DAY_MS
  return {
    ease: Math.round(ease * 100) / 100,
    intervalDays,
    reps,
    lapses,
    dueAt: new Date(dueAt).toISOString(),
    lastReviewedAt: now.toISOString(),
  }
}

/** Whether a card is due at (or before) the given time. */
export function isDue(state: Sm2State, now: Date = new Date()): boolean {
  return new Date(state.dueAt).getTime() <= now.getTime()
}
