import dayjs from 'dayjs'
import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import { WorkflowRepository } from '@/db/repositories/workflow.repository'
import type { AiJobEntity } from '@/types/ai-job'

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** After a workflow step succeeds, enqueue the next step (same run/document). */
export async function enqueueNextWorkflowStep(job: AiJobEntity): Promise<void> {
  if (!job.workflowId || job.workflowStepIndex == null || !job.workflowRunId) return

  const wf = await WorkflowRepository.findById(job.workflowId)
  if (!wf) return

  const nextIndex = job.workflowStepIndex + 1
  const nextStep = wf.steps[nextIndex]
  if (!nextStep) return

  await AiJobRepository.save({
    id: uuid(),
    documentId: job.documentId,
    documentTitle: job.documentTitle,
    modelId: nextStep.modelId,
    promptTemplateId: nextStep.templateId,
    status: 'pending',
    retries: 0,
    createdAt: dayjs().toISOString(),
    jobSource: 'manual',
    priority: job.priority,
    workflowId: job.workflowId,
    workflowStepIndex: nextIndex,
    workflowRunId: job.workflowRunId,
  })
}
