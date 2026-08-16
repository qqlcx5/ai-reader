import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DocumentEntity } from '@/types/document'
import type { ModelConfig } from '@/types/model'
import type { FlashcardEntity } from '@/types/flashcard'
import { FlashcardRepository } from '@/db/repositories/flashcard.repository'
import { MetaRepository } from '@/db/repositories/meta.repository'
import { generateFlashcards } from '@/services/review/generate'
import type { FlashcardMode } from '@/services/review/generate'
import { schedule, isDue, type ReviewGrade } from '@/utils/sm2'
import { recordReview, computeReviewStats, applyNewCardLimit, lastNDays, type ReviewLog, type ReviewStats } from '@/utils/review-stats'
import { nowISO, dateKey } from '@/utils/date'
import { SettingsRepository } from '@/db/repositories/settings.repository'

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
  const stats = ref<ReviewStats>({ total: 0, streak: 0, today: 0 })
  const log = ref<ReviewLog>({})
  const suspendedCount = ref(0)

  async function loadStats(): Promise<void> {
    const log_ = (await MetaRepository.get<ReviewLog>('review-log')) ?? {}
    log.value = log_
    stats.value = computeReviewStats(log_)
    reviewedToday.value = stats.value.today
    suspendedCount.value = (await FlashcardRepository.findSuspended()).length
  }

  async function persistReview(): Promise<void> {
    const log = (await MetaRepository.get<ReviewLog>('review-log')) ?? {}
    await MetaRepository.set('review-log', recordReview(log))
  }

  async function loadQueue(): Promise<void> {
    loading.value = true
    try {
      const now = nowISO()
      const [due, total] = await Promise.all([
        FlashcardRepository.findDue(now),
        FlashcardRepository.count(),
      ])

      // Daily new-card cap (0 = unlimited): review cards always come first,
      // then up to (limit − already-consumed-today) never-reviewed cards.
      let queue_ = due
      const limit = (await SettingsRepository.get())?.review?.newCardsPerDay ?? 0
      if (limit > 0) {
        const newLog = (await MetaRepository.get<ReviewLog>('new-cards-log')) ?? {}
        queue_ = applyNewCardLimit(due, limit, newLog[dateKey()] ?? 0)
      }

      queue.value = queue_
      totalCount.value = total
      flipped.value = false
    } finally {
      loading.value = false
    }
    loadStats().catch(() => {})
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
    persistReview().then(loadStats).catch(() => {})

    // Count a first-time-successful grade as one consumed new card.
    if ((card.sm2.reps ?? 0) === 0 && next.reps > 0) {
      const log = (await MetaRepository.get<ReviewLog>('new-cards-log')) ?? {}
      await MetaRepository.set('new-cards-log', recordReview(log))
    }
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

  /** Suspend the current card (hidden from the queue until resumed). */
  async function suspendCurrent(): Promise<void> {
    const card = queue.value[0]
    if (!card) return
    await FlashcardRepository.save({ ...card, suspended: true, updatedAt: nowISO() })
    queue.value = queue.value.slice(1)
    flipped.value = false
    suspendedCount.value = Math.max(0, suspendedCount.value - 1)
    notifyQueueChanged()
  }

  /** Resume all suspended cards. Returns how many were resumed. */
  async function resumeSuspended(): Promise<number> {
    const n = await FlashcardRepository.resumeAll()
    suspendedCount.value = 0
    await loadQueue()
    notifyQueueChanged()
    return n
  }

  /**
   * Generate flashcards for a document with AI and persist them.
   * Returns the number of new cards created.
   */
  async function generateForDocument(document: DocumentEntity, model: ModelConfig, mode: FlashcardMode = 'qa'): Promise<number> {
    generating.value = true
    generateError.value = null
    try {
      const existing = await FlashcardRepository.findByDocument(document.id)
      const { cards, parseError } = await generateFlashcards({ document, model, existing, mode })
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
    stats,
    log,
    currentCard,
    remainingCount,
    loadQueue,
    flip,
    grade,
    removeCurrent,
    suspendCurrent,
    resumeSuspended,
    suspendedCount,
    generateForDocument,
  }
})
