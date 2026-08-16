import type { Sm2State } from '@/utils/sm2'

export interface FlashcardEntity {
  id: string

  documentId: string
  /** Originating highlight, when the card was generated from one. */
  highlightId?: string

  /** Question / prompt side. */
  front: string
  /** Answer side. */
  back: string

  source: 'ai' | 'manual'

  /** Paused: excluded from the due queue until resumed. */
  suspended?: boolean

  /** How the card was produced — 'qa' (default for legacy rows) or cloze. */
  type?: 'qa' | 'cloze'

  /** Scheduling state; initial state is due immediately. */
  sm2: Sm2State

  createdAt: string
  updatedAt: string
}
