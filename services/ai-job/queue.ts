import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { ModelRepository } from '@/db/repositories/model.repository'
import { SettingsRepository } from '@/db/repositories/settings.repository'
import type { AppSettings } from '@/types/settings'

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
    createdAt: new Date().toISOString(),
  })
}
