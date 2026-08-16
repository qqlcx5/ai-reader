/**
 * Daily resurfacing — pick one old document to re-read each day.
 *
 * Deterministic per day (hash of the date key), so the same document shows
 * all day on every open, and rotates automatically at midnight.
 */
import type { DocumentEntity } from '@/types/document'
import { dateKey } from '@/utils/date'

/** Only documents captured at least this long ago are candidates. */
export const RESURFACE_MIN_AGE_DAYS = 30

/** djb2 string hash → uint32. */
export function hashString(text: string): number {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  }
  return h
}

/**
 * Pick today's resurface document: old enough (>= 30 days), deterministic
 * by calendar day. Returns null when the library has no old documents yet.
 */
export function pickResurfaceDoc(docs: DocumentEntity[], today: Date = new Date()): DocumentEntity | null {
  const minAge = today.getTime() - RESURFACE_MIN_AGE_DAYS * 86_400_000
  const candidates = docs.filter((d) => {
    const t = new Date(d.capturedAt).getTime()
    return !Number.isNaN(t) && t <= minAge
  })
  if (candidates.length === 0) return null

  const seed = hashString(dateKey(today))
  return candidates[seed % candidates.length]
}
