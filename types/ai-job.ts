export type AiJobStatus = 'pending' | 'processing' | 'success' | 'failed'

/**
 * Background auto-analysis job: run a configured prompt template + model against
 * a document (one per doc), persist the result as a conversation, track status.
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
  /** Resulting conversation id once the model reply is saved. */
  conversationId?: string
  error?: string
  retries: number

  createdAt: string
  finishedAt?: string
}
