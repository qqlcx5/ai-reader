import dayjs from 'dayjs'
import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { ModelRepository } from '@/db/repositories/model.repository'
import { SettingsRepository } from '@/db/repositories/settings.repository'
import type { AppSettings } from '@/types/settings'
import type { AiJobPriority } from '@/types/ai-job'

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Enqueue an auto-analysis job for a document. No-op when the feature is off,
 * unconfigured (no template / no usable model), or a job already exists for the
 * document — enforcing one analysis per document. Retry is a separate op.
 */
export async function enqueueForDocument(
  documentId: string,
  settings?: AppSettings,
): Promise<void> {
  const s = settings ?? (await SettingsRepository.get())
  const cfg = s?.autoAnalysis
  if (!cfg?.enabled) return

  const promptTemplateId = cfg.promptTemplateId
  if (!promptTemplateId) return

  const modelId = cfg.modelId || (await ModelRepository.findDefault())?.id
  if (!modelId) return

  // One job per document (dedupe).
  if ((await AiJobRepository.findByDocument(documentId)).length) return

  const doc = await DocumentRepository.findById(documentId)
  await AiJobRepository.save({
    id: uuid(),
    documentId,
    documentTitle: doc?.title,
    modelId,
    promptTemplateId,
    status: 'pending',
    retries: 0,
    createdAt: dayjs().toISOString(),
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
