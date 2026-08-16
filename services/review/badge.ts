/**
 * Browser-action badge showing how many flashcards are due for review.
 * Updated on startup, on the feed alarm, and whenever the panel grades /
 * generates / deletes cards (REVIEW_QUEUE_CHANGED message).
 */
import { FlashcardRepository } from '@/db/repositories/flashcard.repository'
import { nowISO } from '@/utils/date'

const browserApi: any = (globalThis as any).browser ?? (globalThis as any).chrome

/** Format a due count for the badge: '' (hidden), '1'…'99', '99+'. */
export function formatBadgeCount(count: number): string {
  if (count <= 0) return ''
  return count > 99 ? '99+' : String(count)
}

/** Recompute the due count and set the action badge. Never throws. */
export async function updateReviewBadge(): Promise<number> {
  let count = 0
  try {
    count = await FlashcardRepository.countDue(nowISO())
  } catch (e) {
    console.warn('[bg] review badge count failed:', e)
  }
  try {
    await browserApi?.action?.setBadgeText({ text: formatBadgeCount(count) })
    if (count > 0) {
      await browserApi?.action?.setBadgeBackgroundColor({ color: '#e11d48' })
    }
  } catch (e) {
    console.warn('[bg] set badge failed:', e)
  }
  return count
}
