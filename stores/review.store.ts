import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DocumentEntity } from '@/types/document'
import type { ModelConfig } from '@/types/model'
import type { FlashcardEntity } from '@/types/flashcard'
import { FlashcardRepository } from '@/db/repositories/flashcard.repository'
import { generateFlashcards } from '@/services/review/generate'
import { schedule, isDue, type ReviewGrade } from '@/utils/sm2'
import { nowISO } from '@/utils/date'

/** Tell the background worker to refresh the action badge. Best-effort. */
function notifyQueueChanged(): void {
  try {
    ;(globalThis as any).browser?.runtime?.sendMessage?.({ type: 'REVIEW_QUEUE_CHANGED' })?.catch?.(() => {})
  } catch {
    // background unavailable — badge updates on the next alarm
  }
}

export const useReviewStore = defineStore('review', () => {
  /** Remaining cards in this review session (front = current card). */
  const queue = ref<FlashcardEntity[]>([])
  const flipped = ref(false)
  const loading = ref(false)
  const generating = ref(false)
  const generateError = ref<string | null>(null)
  const totalCount = ref(0)

  const currentCard = computed<FlashcardEntity | null>(() => queue.value[0] ?? null)
  const remainingCount = computed(() => queue.value.length)
  const reviewedToday = ref(0)

  async function loadQueue(): Promise<void> {
    loading.value = true
    try {
      const now = nowISO()
      const [due, total] = await Promise.all([
        FlashcardRepository.findDue(now),
        FlashcardRepository.count(),
      ])
      queue.value = due
      totalCount.value = total
      flipped.value = false
    } finally {
      loading.value = false
    }
  }

  function flip(): void {
    if (currentCard.value) flipped.value = !flipped.value
  }

  /**
   * Grade the current card: persist the next SM-2 state and advance.
   * Failed cards go to the back of the session queue.
   */
  async function grade(g: ReviewGrade): Promise<void> {
    const card = queue.value[0]
    if (!card) return
    const next = schedule(card.sm2, g)
    await FlashcardRepository.save({ ...card, sm2: next, updatedAt: nowISO() })
    queue.value = queue.value.slice(1)
    if (isDue(next)) queue.value = [...queue.value, { ...card, sm2: next }]
    flipped.value = false
    reviewedToday.value += 1
    notifyQueueChanged()
  }

  /** Delete the current card and advance. */
  async function removeCurrent(): Promise<void> {
    const card = queue.value[0]
    if (!card) return
    await FlashcardRepository.delete(card.id)
    queue.value = queue.value.slice(1)
    totalCount.value = Math.max(0, totalCount.value - 1)
    flipped.value = false
    notifyQueueChanged()
  }

  /**
   * Generate flashcards for a document with AI and persist them.
   * Returns the number of new cards created.
   */
  async function generateForDocument(document: DocumentEntity, model: ModelConfig): Promise<number> {
    generating.value = true
    generateError.value = null
    try {
      const existing = await FlashcardRepository.findByDocument(document.id)
      const { cards, parseError } = await generateFlashcards({ document, model, existing })
      if (parseError) {
        generateError.value = parseError
        return 0
      }
      if (cards.length > 0) {
        await FlashcardRepository.saveMany(cards)
        totalCount.value += cards.length
        await loadQueue()
      }
      notifyQueueChanged()
      return cards.length
    } catch (err: any) {
      generateError.value = err?.message || '生成失败'
      return 0
    } finally {
      generating.value = false
    }
  }

  return {
    queue,
    flipped,
    loading,
    generating,
    generateError,
    totalCount,
    reviewedToday,
    currentCard,
    remainingCount,
    loadQueue,
    flip,
    grade,
    removeCurrent,
    generateForDocument,
  }
})
