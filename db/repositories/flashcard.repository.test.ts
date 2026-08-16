import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../index'
import { FlashcardRepository } from './flashcard.repository'
import type { FlashcardEntity } from '../../types/flashcard'
import { initialSm2State } from '../../utils/sm2'

function makeCard(overrides: Partial<FlashcardEntity> = {}): FlashcardEntity {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    documentId: 'doc-1',
    front: '问题',
    back: '答案',
    source: 'ai',
    sm2: initialSm2State(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('FlashcardRepository', () => {
  beforeEach(async () => {
    await db.flashcards.clear()
  })

  it('saves and finds by document', async () => {
    await FlashcardRepository.save(makeCard())
    await FlashcardRepository.save(makeCard({ documentId: 'doc-2' }))
    const docs = await FlashcardRepository.findByDocument('doc-1')
    expect(docs).toHaveLength(1)
    expect(docs[0].documentId).toBe('doc-1')
  })

  it('findDue returns only cards due at or before now, oldest first', async () => {
    const past = makeCard({ id: 'past', sm2: { ...initialSm2State(), dueAt: '2025-01-01T00:00:00.000Z' } })
    const now = makeCard({ id: 'now', sm2: { ...initialSm2State(), dueAt: '2025-01-02T00:00:00.000Z' } })
    const future = makeCard({ id: 'future', sm2: { ...initialSm2State(), dueAt: '2025-01-03T00:00:00.000Z' } })
    await FlashcardRepository.saveMany([future, past, now])

    const due = await FlashcardRepository.findDue('2025-01-02T00:00:00.000Z')
    expect(due.map((c) => c.id)).toEqual(['past', 'now'])
    expect(await FlashcardRepository.countDue('2025-01-02T00:00:00.000Z')).toBe(2)
  })

  it('limits findDue results', async () => {
    await FlashcardRepository.saveMany([
      makeCard({ sm2: { ...initialSm2State(), dueAt: '2025-01-01T00:00:00.000Z' } }),
      makeCard({ sm2: { ...initialSm2State(), dueAt: '2025-01-01T00:00:00.000Z' } }),
    ])
    expect(await FlashcardRepository.findDue('2025-01-02T00:00:00.000Z', 1)).toHaveLength(1)
  })

  it('deletes by document', async () => {
    await FlashcardRepository.saveMany([makeCard(), makeCard()])
    await FlashcardRepository.deleteByDocument('doc-1')
    expect(await FlashcardRepository.count()).toBe(0)
  })
})
