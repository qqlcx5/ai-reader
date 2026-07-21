import type { AiJobPriority } from './ai-job'

/** Which documents a schedule should process when it fires. */
export type ScheduleScope = 'today' | 'unread' | 'all' | 'collection'

/**
 * A cron-triggered auto-analysis plan. Stored in the `schedules` store.
 * Background alarm checks every minute; when a schedule's cron matches the
 * current time, it queries documents by scope and enqueues batch jobs.
 *
 * Cron format: standard 5-field (min hour day month weekday).
 */
export interface ScheduleEntity {
  id: string
  enabled: boolean
  /** Human-readable label. */
  label: string
  /** 5-field cron expression, e.g. "0 23 * * *". */
  cron: string
  scope: ScheduleScope
  /** Required when scope === 'collection'. */
  collectionId?: string
  /** ModelConfig.id used for enqueued jobs. */
  modelId: string
  /** PromptTemplate.id whose content becomes the prompt. */
  promptTemplateId: string
  priority: AiJobPriority

  /** Last fired timestamp (ISO). Used for UI + to avoid double-fire within the same minute. */
  lastFiredAt?: string
  /** Last fire result summary. */
  lastFireError?: string

  createdAt: string
  updatedAt: string
}
