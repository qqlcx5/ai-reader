import dayjs from 'dayjs'
import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { ModelRepository } from '@/db/repositories/model.repository'
import { WorkflowRepository } from '@/db/repositories/workflow.repository'
import { findMatchingRule } from '@/services/ai-job/rule-engine'
import type { AiJobPriority } from '@/types/ai-job'
import type { WorkflowEntity } from '@/types/workflow'

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

const browser: any = (globalThis as any).browser ?? (globalThis as any).chrome

/** Track enqueue skips for batch notification. Reset on each refresh cycle. */
let enqueueSkips = { noModel: 0, total: 0 }

/** Flush a notification to the panel (if open) about skipped auto-analyses. */
export function notifyEnqueueSkips() {
  if (enqueueSkips.noModel === 0) return
  try {
    browser?.runtime?.sendMessage?.({
      type: 'AI_JOB_SKIPPED',
      payload: {
        reason: 'no_model',
        count: enqueueSkips.noModel,
        message: `RSS 自动收集了 ${enqueueSkips.total} 篇文章，但未配置默认模型，已跳过自动分析`,
      },
    })
  } catch { /* panel may not be open */ }
  enqueueSkips = { noModel: 0, total: 0 }
}

/**
 * Enqueue an auto-analysis job for a document. No-op when unconfigured
 * (no usable model) or a job already exists for the document — enforcing
 * one analysis per document. Retry is a separate op.
 *
 * Auto-analysis is always on for newly captured docs. Model/template/priority
 * resolution order:
 *   1. First matching analysis rule (if any) overrides the defaults.
 *   2. Falls back to the global default model + system prompt (priority normal).
 */
export async function enqueueForDocument(
  documentId: string,
): Promise<void> {
  // One job per document (dedupe).
  if ((await AiJobRepository.findByDocument(documentId)).length) return

  const doc = await DocumentRepository.findById(documentId)
  if (!doc) return

  // Rule match overrides default model/template/priority.
  const matchedRule = await findMatchingRule(doc)
  const modelId = matchedRule?.modelId || (await ModelRepository.findDefault())?.id
  if (!modelId) {
    enqueueSkips.noModel++
    enqueueSkips.total++
    return
  }
  enqueueSkips.total++

  // A matching rule may intentionally use only the system prompt; the default
  // auto-analysis path does too (system prompt only).
  const promptTemplateId = matchedRule?.promptTemplateId || ''
  const priority: AiJobPriority = matchedRule?.priority ?? 'normal'

  await AiJobRepository.save({
    id: uuid(),
    documentId,
    documentTitle: doc.title,
    modelId,
    promptTemplateId,
    status: 'pending',
    retries: 0,
    createdAt: dayjs().toISOString(),
    priority,
  })
}

export interface BatchEnqueueOptions {
  documentIds: string[]
  modelId: string
  promptTemplateId?: string
  /** Optional batch ID to group jobs together. Auto-generated if omitted. */
  batchId?: string
  /** Priority for all jobs in this batch. Default 'normal'. */
  priority?: AiJobPriority
}

export interface BatchEnqueueResult {
  enqueued: number
  skipped: number
  batchId: string
}

/**
 * Enqueue analysis jobs for multiple documents at once (manual batch trigger).
 * Bypasses the auto-analysis enabled check and the one-per-document dedupe —
 * allows re-analyzing a document with a different template or model.
 * Returns the count of enqueued and skipped (not found) documents.
 */
export async function enqueueBatch(
  opts: BatchEnqueueOptions,
): Promise<BatchEnqueueResult> {
  const { documentIds, modelId, promptTemplateId } = opts
  const batchId = opts.batchId ?? uuid()
  if (!documentIds.length || !modelId) return { enqueued: 0, skipped: 0, batchId }

  let enqueued = 0
  let skipped = 0
  const now = dayjs().toISOString()

  for (const documentId of documentIds) {
    const doc = await DocumentRepository.findById(documentId)
    if (!doc) {
      skipped++
      continue
    }
    await AiJobRepository.save({
      id: uuid(),
      documentId,
      documentTitle: doc.title,
      modelId,
      promptTemplateId: promptTemplateId ?? '',
      status: 'pending',
      retries: 0,
      createdAt: now,
      batchId,
      jobSource: 'manual',
      priority: opts.priority ?? 'normal',
    })
    enqueued++
  }

  return { enqueued, skipped, batchId }
}

export interface WorkflowEnqueueOptions {
  documentIds: string[]
  workflowId: string
  /** Priority for all jobs across all steps. Default the workflow's priority. */
  priority?: AiJobPriority
}

export interface WorkflowEnqueueResult {
  enqueuedDocs: number
  skippedDocs: number
  runId: string
}

/** Enqueue a workflow run: each document starts at step 0; subsequent steps
 *  are enqueued by the processor when the previous step succeeds. All jobs
 *  for one (doc, run) share workflowRunId so the UI can group them. */
export async function enqueueWorkflow(
  opts: WorkflowEnqueueOptions,
): Promise<WorkflowEnqueueResult> {
  const { documentIds, workflowId } = opts
  const runId = uuid()
  if (!documentIds.length || !workflowId) {
    return { enqueuedDocs: 0, skippedDocs: 0, runId }
  }

  const wf = await WorkflowRepository.findById(workflowId)
  if (!wf || !wf.enabled || !wf.steps.length || wf.steps.some((step) => !step.modelId)) {
    return { enqueuedDocs: 0, skippedDocs: 0, runId }
  }

  const priority = opts.priority ?? wf.priority
  const firstStep = wf.steps[0]
  let enqueuedDocs = 0
  let skippedDocs = 0
  const now = dayjs().toISOString()

  for (const documentId of documentIds) {
    const doc = await DocumentRepository.findById(documentId)
    if (!doc) {
      skippedDocs++
      continue
    }
    await AiJobRepository.save({
      id: uuid(),
      documentId,
      documentTitle: doc.title,
      modelId: firstStep.modelId,
      promptTemplateId: firstStep.templateId,
      status: 'pending',
      retries: 0,
      createdAt: now,
      jobSource: 'manual',
      priority,
      workflowId,
      workflowStepIndex: 0,
      workflowRunId: runId,
    })
    enqueuedDocs++
  }

  return { enqueuedDocs, skippedDocs, runId }
}
