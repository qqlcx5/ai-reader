import { DocumentRepository } from '@/db/repositories/document.repository'
import { ModelRepository } from '@/db/repositories/model.repository'
import { ChatRepository } from '@/db/repositories/chat.repository'
import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import { SettingsRepository } from '@/db/repositories/settings.repository'
import { db } from '@/db'
import { createProvider } from '@/services/ai/factory'
import { buildPageContext } from '@/services/prompt/context'
import { truncateContext } from '@/services/prompt/truncate'
import { PromptBuilder } from '@/services/prompt/builder'
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

/** Process one job: build the prompt, call the model, save a conversation.
 *  Auto-retries on transient failures (network, timeout, 5xx) up to
 *  model.maxRetries times, with exponential backoff. */
async function processJob(job: AiJobEntity, settings: AppSettings | undefined): Promise<'success' | 'failed'> {
  await AiJobRepository.setStatus(job.id, 'processing')

  // Resolve model once to read its maxRetries config
  const model = await ModelRepository.findById(job.modelId)
  if (!model) {
    await AiJobRepository.setStatus(job.id, 'failed', {
      error: '模型不存在',
      finishedAt: new Date().toISOString(),
    })
    return 'failed'
  }
  const maxRetries = model.maxRetries ?? DEFAULT_MAX_RETRIES

  let lastError = ''
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const doc = await DocumentRepository.findById(job.documentId)
      if (!doc) throw new Error('文档不存在')
      const template = await db.promptTemplates.get(job.promptTemplateId)
      if (!template) throw new Error('提示词模板不存在')

      let context: string | undefined
      if (doc.markdown) {
        const pageCtx = buildPageContext(
          {
            title: doc.title,
            url: doc.url,
            markdown: doc.markdown,
            wordCount: doc.wordCount,
            tokenCount: doc.tokenCount,
            siteName: doc.siteName,
            capturedAt: doc.capturedAt,
          },
          settings?.context,
        )
        const maxContext = model.contextWindow
          ? Math.min(model.contextWindow, settings?.context.maxContextTokens ?? 1_050_000)
          : settings?.context.maxContextTokens ?? 1_050_000
        context = truncateContext(pageCtx, maxContext)
      }

      const out = new PromptBuilder().build({
        systemPrompt: model.systemPrompt || settings?.globalSystemPrompt,
        context,
        userInput: template.content,
      })

      const result = await createProvider(model).chat({
        model,
        systemPrompt: out.system,
        messages: out.messages,
      })

      const now = new Date().toISOString()
      const conversation: ConversationEntity = {
        id: uuid(),
        documentId: doc.id,
        title: template.title,
        messages: [
          { id: uuid(), role: 'user', content: template.content, createdAt: now },
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
      return 'success'
    } catch (e) {
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
    finishedAt: new Date().toISOString(),
  })
  return 'failed'
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
 *  marks the job failed and the loop continues. */
export async function drainAll(): Promise<{ processed: number; succeeded: number; failed: number }> {
  const settings = await SettingsRepository.get()
  const pending = await AiJobRepository.findPending()
  let succeeded = 0
  let failed = 0
  for (const job of pending) {
    const r = await processJob(job, settings)
    if (r === 'success') succeeded++
    else failed++
  }
  return { processed: pending.length, succeeded, failed }
}
