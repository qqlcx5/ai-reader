import dayjs from 'dayjs'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { ModelRepository } from '@/db/repositories/model.repository'
import { ChatRepository } from '@/db/repositories/chat.repository'
import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import { db } from '@/db'
import { createProvider } from '@/services/ai/factory'
import { buildAnalysisPrompt } from '@/services/prompt/analysis'
import { enqueueNextWorkflowStep } from '@/services/ai-job/workflow-continue'
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
export const activeControllers = new Map<string, AbortController>()

export type ProcessResult = 'success' | 'failed' | 'cancelled'

/** Process one job: build the prompt, call the model, save a conversation.
 *  Auto-retries on transient failures (network, timeout, 5xx) up to
 *  model.maxRetries times, with exponential backoff. */
export async function processJob(
  job: AiJobEntity,
  settings: AppSettings | undefined,
): Promise<ProcessResult> {
  await AiJobRepository.setStatus(job.id, 'processing')

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
      if (job.cancelRequested || controller.signal.aborted) {
        await markCancelled(job.id)
        return 'cancelled'
      }

      try {
        const doc = await DocumentRepository.findById(job.documentId)
        if (!doc) throw new Error('文档不存在')

        const template = job.promptTemplateId
          ? await db.promptTemplates.get(job.promptTemplateId)
          : null
        if (job.promptTemplateId && !template) {
          throw new Error('提示词模板不存在')
        }

        const out = buildAnalysisPrompt({
          model,
          fallbackSystemPrompt: settings?.globalSystemPrompt,
          promptTemplateContent: template?.content,
          contextSettings: settings?.context,
          page: doc.markdown
            ? {
                title: doc.title,
                url: doc.url,
                markdown: doc.markdown,
                wordCount: doc.wordCount,
                tokenCount: doc.tokenCount,
                siteName: doc.siteName,
                capturedAt: doc.capturedAt,
              }
            : undefined,
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
        await AiJobRepository.setStatus(job.id, 'success', {
          conversationId: conversation.id,
          finishedAt: now,
          error: undefined,
        })
        if (job.workflowRunId && job.workflowId && job.workflowStepIndex != null) {
          await enqueueNextWorkflowStep(job)
        }
        return 'success'
      } catch (e) {
        if (controller.signal.aborted || job.cancelRequested) {
          await markCancelled(job.id)
          return 'cancelled'
        }
        lastError = e instanceof Error ? e.message : String(e)

        if (isPermanentError(lastError)) break

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

/** Classify errors that should not be retried. */
export function isPermanentError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return (
    lower.includes('401')
    || lower.includes('403')
    || lower.includes('模型不存在')
    || lower.includes('文档不存在')
    || lower.includes('提示词模板不存在')
    || lower.includes('invalid_api_key')
    || lower.includes('authentication')
  )
}
