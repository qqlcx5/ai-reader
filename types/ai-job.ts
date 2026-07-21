export type AiJobStatus = 'pending' | 'processing' | 'success' | 'failed' | 'cancelled'

/** Job priority — higher = processed first by the scheduler. */
export type AiJobPriority = 'high' | 'normal' | 'low'

/** Numeric priority for sorting (higher number = higher priority). */
export const PRIORITY_WEIGHT: Record<AiJobPriority, number> = {
  high: 3,
  normal: 2,
  low: 1,
}

/**
 * Background auto-analysis job: run a configured prompt template + model against
 * a document, persist the result as a conversation, track status.
 * Drained by the panel-side processor (see services/ai-job/processor.ts).
 */
export interface AiJobEntity {
  id: string

  /** Natural key — at most one job per document (one analysis per doc). */
  documentId: string
  /** Denormalized for queue display. */
  documentTitle?: string
  modelId: string
  promptTemplateId: string

  status: AiJobStatus
  /** Set by cancel(); the processor checks it between retries and aborts the in-flight request. */
  cancelRequested?: boolean
  /** Resulting conversation id once the model reply is saved. */
  conversationId?: string
  error?: string
  retries: number

  createdAt: string
  finishedAt?: string

  /** If this job is one step of a workflow run, the workflow id. */
  workflowId?: string
  /** If part of a workflow run, the step index (0-based). */
  workflowStepIndex?: number
  /** Run instance id grouping all jobs from one workflow invocation. */
  workflowRunId?: string

  /** Batch ID for grouping jobs from the same batch trigger. */
  batchId?: string
  /** Source: auto (on capture) or manual (user-triggered batch). */
  jobSource?: 'auto' | 'manual'

  /** Priority for queue scheduling. Default 'normal'. */
  priority?: AiJobPriority
  /** User-set sort order within the same priority (lower = earlier). */
  sortOrder?: number
}

/** Aggregated stats for a group of jobs (e.g. by status, by model, by batch). */
export interface AiJobStats {
  total: number
  pending: number
  processing: number
  success: number
  failed: number
  cancelled: number
  /** Success rate (0–1). */
  successRate: number
  /** Average processing duration in ms (finished jobs only). */
  avgDurationMs: number
}

/** Filter options for querying the job list. */
export interface AiJobFilter {
  status?: AiJobStatus | 'all'
  modelId?: string
  batchId?: string
  search?: string
}
