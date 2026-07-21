import dayjs from 'dayjs'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { ModelRepository } from '@/db/repositories/model.repository'
import { ChatRepository } from '@/db/repositories/chat.repository'
import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import { SettingsRepository } from '@/db/repositories/settings.repository'
import { db } from '@/db'
import { createProvider } from '@/services/ai/factory'
import { buildAnalysisPrompt } from '@/services/prompt/analysis'
import { WorkflowRepository } from '@/db/repositories/workflow.repository'
import type { AppSettings } from '@/types/settings'
import type { AiJobEntity } from '@/types/ai-job'
import type { ConversationEntity } from '@/types/chat'

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Max auto-retries per job before giving up. Fallback when model not loaded yet. */
const DEFAULT_MAX_RETRIES = 2
/** Base backoff in ms; actual delay = BASE * 2^attempt. */
const RETRY_BASE_MS = 2000

/** In-flight AbortControllers, keyed by job id. Populated by processJob,
 *  drained on completion / cancel. cancelJob() aborts the live request. */
const activeControllers = new Map<string, AbortController>()

/** User-initiated cancel. Marks the job so the next retry check bails out,
 *  aborts any in-flight provider request, and sets status to 'cancelled'.
 *  No-op if the job isn't currently processing. */
export async function cancelJob(jobId: string): Promise<void> {
  await AiJobRepository.savePatch(jobId, { cancelRequested: true })
  activeControllers.get(jobId)?.abort()
  // The processor writes the final 'cancelled' status when it observes the
  // abort; this is a fallback for the race where cancel arrives between
  // setStatus('processing') and controller registration.
  await AiJobRepository.setStatus(jobId, 'cancelled', {
    finishedAt: dayjs().toISOString(),
    error: undefined,
  })
}

type ProcessResult = 'success' | 'failed' | 'cancelled'

/** Process one job: build the prompt, call the model, save a conversation.
 *  Auto-retries on transient failures (network, timeout, 5xx) up to
 *  model.maxRetries times, with exponential backoff. */
async function processJob(job: AiJobEntity, settings: AppSettings | undefined): Promise<ProcessResult> {
  await AiJobRepository.setStatus(job.id, 'processing')

  // Resolve model once to read its maxRetries config
  const model = await ModelRepository.findById(job.modelId)
  if (!model) {
    await AiJobRepository.setStatus(job.id, 'failed', {
      error: '模型不存在',
      finishedAt: dayjs().toISOString(),
    })
    return 'failed'
  }
  const maxRetries = model.maxRetries ?? DEFAULT_MAX_RETRIES

  const controller = new AbortController()
  activeControllers.set(job.id, controller)

  try {
    let lastError = ''
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Honor a cancel that landed between retries.
      if (job.cancelRequested || controller.signal.aborted) {
        await markCancelled(job.id)
        return 'cancelled'
      }

      try {
        const doc = await DocumentRepository.findById(job.documentId)
        if (!doc) throw new Error('文档不存在')
        // promptTemplateId is optional. If unset, we use whatever system prompt
        // the model / global settings already provide. If both system and
        // template are empty, fall back to a minimal instruction so the model
        // always has something to act on.
        const template = job.promptTemplateId
          ? await db.promptTemplates.get(job.promptTemplateId)
          : null
        // Only complain if a template id was *explicitly* set but the row is gone
        // (e.g. the user deleted it). An unset id is a valid "no template" choice.
        if (job.promptTemplateId && !template) {
          throw new Error('提示词模板不存在')
        }

        const out = buildAnalysisPrompt({
          model,
          fallbackSystemPrompt: settings?.globalSystemPrompt,
          promptTemplateContent: template?.content,
          contextSettings: settings?.context,
          page: doc.markdown ? {
            title: doc.title,
            url: doc.url,
            markdown: doc.markdown,
            wordCount: doc.wordCount,
            tokenCount: doc.tokenCount,
            siteName: doc.siteName,
            capturedAt: doc.capturedAt,
          } : undefined,
        })

        const result = await createProvider(model).chat({
          model,
          systemPrompt: out.system,
          messages: out.messages,
          signal: controller.signal,
        })

        const now = dayjs().toISOString()
        const conversation: ConversationEntity = {
          id: uuid(),
          documentId: doc.id,
          title: template?.title ?? '自动分析',
          messages: [
            { id: uuid(), role: 'user', content: out.sentUserContent, createdAt: now },
            {
              id: uuid(),
              role: 'assistant',
              content: result.content,
              modelId: model.modelId,
              status: 'success',
              createdAt: now,
              tokenUsage: result.usage,
            },
          ],
          createdAt: now,
          updatedAt: now,
        }
        await ChatRepository.save(conversation)
        await AiJobRepository.setStatus(job.id, 'success', { conversationId: conversation.id, finishedAt: now, error: undefined })
        // Workflow chain: if this job was a non-final step, enqueue the next step.
        if (job.workflowRunId && job.workflowId && job.workflowStepIndex != null) {
          await enqueueNextWorkflowStep(job)
        }
        return 'success'
      } catch (e) {
        // Cancel aborts the in-flight request. Don't retry, don't mark failed.
        if (controller.signal.aborted || job.cancelRequested) {
          await markCancelled(job.id)
          return 'cancelled'
        }
        lastError = e instanceof Error ? e.message : String(e)

        // Permanent failures — don't retry
        if (isPermanentError(lastError)) {
          break
        }

        // Transient error — retry if attempts remain
        if (attempt < maxRetries) {
          const retryCount = attempt + 1
          await AiJobRepository.setStatus(job.id, 'processing', {
            error: `${lastError}（正在重试 ${retryCount}/${maxRetries}…）`,
          })
          const delay = RETRY_BASE_MS * Math.pow(2, attempt)
          await new Promise((r) => setTimeout(r, delay))
        }
      }
    }

    // All retries exhausted
    const retryLabel = maxRetries > 0 ? `（已重试 ${maxRetries} 次）` : ''
    await AiJobRepository.setStatus(job.id, 'failed', {
      error: `${lastError}${retryLabel}`,
      finishedAt: dayjs().toISOString(),
    })
    return 'failed'
  } finally {
    activeControllers.delete(job.id)
  }
}

async function markCancelled(jobId: string): Promise<void> {
  await AiJobRepository.setStatus(jobId, 'cancelled', {
    finishedAt: dayjs().toISOString(),
    error: undefined,
  })
}

/** Workflow chain continuation. Called after a workflow job succeeds: looks up
 *  the next step in the workflow definition and enqueues it with the same
 *  runId / document. If the current step was the last one, no-op. */
async function enqueueNextWorkflowStep(job: AiJobEntity): Promise<void> {
  const wf = await WorkflowRepository.findById(job.workflowId!)
  if (!wf) return
  const nextIndex = (job.workflowStepIndex ?? 0) + 1
  const nextStep = wf.steps[nextIndex]
  if (!nextStep) return // last step finished
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

/** Classify errors that should not be retried. */
function isPermanentError(msg: string): boolean {
  const lower = msg.toLowerCase()
  // Auth errors, invalid model, missing config — retrying won't help
  return lower.includes('401')
    || lower.includes('403')
    || lower.includes('模型不存在')
    || lower.includes('文档不存在')
    || lower.includes('提示词模板不存在')
    || lower.includes('invalid_api_key')
    || lower.includes('authentication')
}

/** Drain all pending jobs sequentially (panel-driven). Best-effort: a failure
 *  marks the job failed and the loop continues.
 *  Respects the queue-paused flag: if paused, returns immediately without
 *  processing — in-flight jobs finish naturally. */
export async function drainAll(): Promise<{ processed: number; succeeded: number; failed: number; cancelled: number }> {
  const settings = await SettingsRepository.get()

  // Respect queue-pause: don't pick up new jobs when paused
  if (settings?.autoAnalysis?.queuePaused) {
    return { processed: 0, succeeded: 0, failed: 0, cancelled: 0 }
  }

  const pending = await AiJobRepository.findPending()
  let succeeded = 0
  let failed = 0
  let cancelled = 0
  for (const job of pending) {
    // Re-check pause flag inside the loop — user may pause mid-drain
    if (settings?.autoAnalysis?.queuePaused) break
    // Re-read in case cancel / priority changed since findPending()
    const fresh = await AiJobRepository.findById(job.id)
    if (!fresh || fresh.status !== 'pending') continue
    const r = await processJob(fresh, settings)
    if (r === 'success') succeeded++
    else if (r === 'cancelled') cancelled++
    else failed++
  }
  return { processed: succeeded + failed + cancelled, succeeded, failed, cancelled }
}

/** On startup: reclaim jobs stuck in 'processing' after a crash / SW restart. */
export async function reclaimStaleJobs(): Promise<number> {
  const stuck = await AiJobRepository.findByStatus('processing')
  for (const job of stuck) {
    await AiJobRepository.setStatus(job.id, 'failed', {
      error: '处理中断（扩展重启）',
      finishedAt: dayjs().toISOString(),
    })
  }
  return stuck.length
}
