import type { AiJobPriority } from './ai-job'

/**
 * A reusable multi-step analysis pipeline. Each step runs one prompt template
 * against one model. Steps run sequentially; a step can optionally wait for
 * the previous step's job to finish before starting.
 *
 * Stored in the `workflows` store. Executed by enqueueing one AiJob per step
 * per document (see enqueueWorkflow in services/ai-job/queue.ts).
 */
export interface WorkflowStep {
  id: string
  /** PromptTemplate.id whose content becomes this step's prompt. */
  templateId: string
  /** ModelConfig.id used for this step. */
  modelId: string
  /** Display label shown in the UI. */
  label: string
}

export interface WorkflowEntity {
  id: string
  name: string
  description: string
  enabled: boolean
  steps: WorkflowStep[]
  /** Default priority for jobs spawned by this workflow. */
  priority: AiJobPriority
  createdAt: string
  updatedAt: string
}
