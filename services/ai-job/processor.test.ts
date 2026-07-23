import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/db'

const chatMock = vi.fn(async (_input?: any) => ({ content: 'AI 摘要内容', usage: { totalTokens: 42 } }))
vi.mock('@/services/ai/factory', () => ({
  createProvider: () => ({ chat: chatMock }),
}))

import { drainAll, cancelJob, reclaimStaleJobs } from './processor'
import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import { ChatRepository } from '@/db/repositories/chat.repository'

async function resetDB() {
  await Promise.all(
    [db.documents, db.conversations, db.models, db.settings, db.kvMeta, db.promptTemplates, db.aiJobs].map((t) =>
      t.clear(),
    ),
  )
}

describe('ai-job processor', () => {
  beforeEach(async () => {
    chatMock.mockReset()
    chatMock.mockResolvedValue({ content: 'AI 摘要内容', usage: { totalTokens: 42 } })
    await resetDB()
    await db.documents.put({
      id: 'doc-1',
      url: 'https://x.test/a',
      title: 'An Article',
      markdown: '正文内容',
      wordCount: 2,
      tokenCount: 3,
      contentHash: 'h1',
      extractionMethod: 'manual',
      source: 'library',
      capturedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    await db.models.put({
      id: 'm1',
      name: 'Test',
      provider: 'openai-compatible',
      modelId: 'gpt-x',
      enabled: true,
      isDefault: true,
      contextWindow: 128000,
      temperature: 0.7,
      maxRetries: 0, // tests should run fast — no exponential backoff delays
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any)
    await db.promptTemplates.put({
      id: 'tpl-1',
      title: '总结要点',
      content: '请总结这篇文章',
      category: 'builtin',
      isBuiltin: true,
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00Z',
    })
  })

  it('processes a pending job: calls the model, saves a conversation, marks success', async () => {
    await AiJobRepository.save({
      id: 'job-1',
      documentId: 'doc-1',
      modelId: 'm1',
      promptTemplateId: 'tpl-1',
      status: 'pending',
      retries: 0,
      createdAt: '2026-01-02T00:00:00Z',
    })

    const r = await drainAll()
    expect(r.processed).toBe(1)
    expect(r.succeeded).toBe(1)
    expect(chatMock).toHaveBeenCalledTimes(1)

    const job = await AiJobRepository.findById('job-1')
    expect(job?.status).toBe('success')
    expect(job?.conversationId).toBeTruthy()

    const conv = await ChatRepository.findById(job!.conversationId!)
    expect(conv?.documentId).toBe('doc-1')
    expect(conv?.messages).toHaveLength(2)
    expect(conv?.messages[1].content).toBe('AI 摘要内容')
    expect(conv?.messages[1].status).toBe('success')
  })

  it('marks the job failed when the model call throws', async () => {
    // mockRejectedValue (not Once) — the processor may retry up to maxRetries
    // times, so the mock has to fail every call for the job to be marked failed.
    chatMock.mockRejectedValue(new Error('rate limited'))
    await AiJobRepository.save({
      id: 'job-2',
      documentId: 'doc-1',
      modelId: 'm1',
      promptTemplateId: 'tpl-1',
      status: 'pending',
      retries: 0,
      createdAt: '2026-01-02T00:00:00Z',
    })

    const r = await drainAll()
    expect(r.failed).toBe(1)
    const job = await AiJobRepository.findById('job-2')
    expect(job?.status).toBe('failed')
    expect(job?.error).toContain('rate limited')
  })

  it('fails when the model is missing', async () => {
    await AiJobRepository.save({
      id: 'job-3',
      documentId: 'doc-1',
      modelId: 'nope',
      promptTemplateId: 'tpl-1',
      status: 'pending',
      retries: 0,
      createdAt: '2026-01-02T00:00:00Z',
    })
    await drainAll()
    expect((await AiJobRepository.findById('job-3'))?.status).toBe('failed')
  })

  it('succeeds when promptTemplateId is undefined and the model has a systemPrompt', async () => {
    await db.models.put({
      id: 'm2',
      name: 'Test 2',
      provider: 'openai-compatible',
      modelId: 'gpt-x',
      enabled: true,
      isDefault: false,
      contextWindow: 128000,
      temperature: 0.7,
      maxRetries: 0,
      systemPrompt: '你是一个严谨的阅读助手。',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any)
    await AiJobRepository.save({
      id: 'job-no-tpl',
      documentId: 'doc-1',
      modelId: 'm2',
      // promptTemplateId intentionally omitted
      status: 'pending',
      retries: 0,
      createdAt: '2026-01-02T00:00:00Z',
    } as any)

    const r = await drainAll()
    expect(r.succeeded).toBe(1)
    const job = await AiJobRepository.findById('job-no-tpl')
    expect(job?.status).toBe('success')
    // system 和 template 是正交的：无 template → 只发 1 条 user message (context)
    expect(chatMock).toHaveBeenCalledTimes(1)
    const callArgs = (chatMock.mock.calls as unknown as Array<[{ systemPrompt?: string; messages: Array<{ role: string; content: string }> }]>)[0]?.[0]
    expect(callArgs).toBeDefined()
    expect(callArgs!.systemPrompt).toBe('你是一个严谨的阅读助手。')
    const userMessages = callArgs!.messages.filter((m) => m.role === 'user')
    expect(userMessages.length).toBe(1) // 只发 context
  })

  it('runs in pure context-only mode when neither template nor system prompt is set', async () => {
    await db.models.put({
      id: 'm3',
      name: 'Test 3',
      provider: 'openai-compatible',
      modelId: 'gpt-x',
      enabled: true,
      isDefault: false,
      contextWindow: 128000,
      temperature: 0.7,
      maxRetries: 0,
      // no systemPrompt
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any)
    await AiJobRepository.save({
      id: 'job-no-sys',
      documentId: 'doc-1',
      modelId: 'm3',
      // promptTemplateId intentionally omitted
      status: 'pending',
      retries: 0,
      createdAt: '2026-01-02T00:00:00Z',
    } as any)

    const r = await drainAll()
    expect(r.succeeded).toBe(1)
    const job = await AiJobRepository.findById('job-no-sys')
    expect(job?.status).toBe('success')
    // 纯裸调：无 system、无 template → 只发 1 条 user message (context)
    expect(chatMock).toHaveBeenCalledTimes(1)
    const callArgs = (chatMock.mock.calls as unknown as Array<[{ systemPrompt?: string; messages: Array<{ role: string; content: string }> }]>)[0]?.[0]
    expect(callArgs).toBeDefined()
    expect(callArgs!.systemPrompt).toBeUndefined()
    const userMessages = callArgs!.messages.filter((m) => m.role === 'user')
    expect(userMessages.length).toBe(1) // 只发 context
  })

  it('fails when promptTemplateId is set but the template row is missing', async () => {
    await AiJobRepository.save({
      id: 'job-tpl-gone',
      documentId: 'doc-1',
      modelId: 'm1',
      promptTemplateId: 'tpl-deleted',
      status: 'pending',
      retries: 0,
      createdAt: '2026-01-02T00:00:00Z',
    })
    const r = await drainAll()
    expect(r.failed).toBe(1)
    const job = await AiJobRepository.findById('job-tpl-gone')
    expect(job?.status).toBe('failed')
    expect(job?.error).toContain('提示词模板不存在')
  })

  it('skips processing when queue is paused', async () => {
    // Save settings with queuePaused = true
    await db.settings.put({
      id: 'app-settings',
      globalSystemPrompt: '',
      context: {
        maxContextTokens: 1050000,
        includeMetadataInPrompt: true,
        includeUrlInPrompt: true,
        includeTitleInPrompt: true,
        includeCapturedAtInPrompt: false,
        includeConversationHistory: true,
        maxHistoryMessages: 20,
      },
      capture: {
        autoExtractOnOpen: true,
        autoExtractOnTabChange: false,
        preferCache: true,
        saveRawHtml: false,
        compressRawHtml: true,
      },
      autoAnalysis: { enabled: true, modelId: 'm1', promptTemplateId: 'tpl-1', queuePaused: true },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any)

    await AiJobRepository.save({
      id: 'job-paused',
      documentId: 'doc-1',
      modelId: 'm1',
      promptTemplateId: 'tpl-1',
      status: 'pending',
      retries: 0,
      createdAt: '2026-01-02T00:00:00Z',
    })

    const r = await drainAll()
    expect(r.processed).toBe(0)
    expect(chatMock).not.toHaveBeenCalled()
    const job = await AiJobRepository.findById('job-paused')
    expect(job?.status).toBe('pending')
  })

  it('stops before the next job when the queue is paused mid-drain', async () => {
    let calls = 0
    chatMock.mockImplementation(async () => {
      calls++
      await db.settings.put({ id: 'app-settings', autoAnalysis: { queuePaused: true } } as any)
      return { content: 'ok', usage: { totalTokens: 1 } }
    })

    await AiJobRepository.save({ id: 'job-first', documentId: 'doc-1', modelId: 'm1', promptTemplateId: 'tpl-1', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z' })
    await AiJobRepository.save({ id: 'job-second', documentId: 'doc-1', modelId: 'm1', promptTemplateId: 'tpl-1', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z' })

    const r = await drainAll()
    expect(r.processed).toBe(1)
    expect(calls).toBe(1)
    expect((await AiJobRepository.findById('job-first'))?.status).toBe('success')
    expect((await AiJobRepository.findById('job-second'))?.status).toBe('pending')
  })

  it('processes pending jobs sorted by priority (high first)', async () => {
    // Save settings (not paused)
    await db.settings.put({
      id: 'app-settings',
      globalSystemPrompt: '',
      context: { maxContextTokens: 1050000, includeMetadataInPrompt: true, includeUrlInPrompt: true, includeTitleInPrompt: true, includeCapturedAtInPrompt: false, includeConversationHistory: true, maxHistoryMessages: 20 },
      capture: { autoExtractOnOpen: true, autoExtractOnTabChange: false, preferCache: true, saveRawHtml: false, compressRawHtml: true },
      autoAnalysis: { enabled: true, modelId: 'm1', promptTemplateId: 'tpl-1' },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any)

    const callOrder: string[] = []
    chatMock.mockImplementation(async () => {
      callOrder.push('called')
      return { content: 'ok', usage: { totalTokens: 1 } }
    })

    await AiJobRepository.save({ id: 'job-low', documentId: 'doc-1', modelId: 'm1', promptTemplateId: 'tpl-1', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z', priority: 'low' })
    await AiJobRepository.save({ id: 'job-high', documentId: 'doc-1', modelId: 'm1', promptTemplateId: 'tpl-1', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z', priority: 'high' })
    await AiJobRepository.save({ id: 'job-normal', documentId: 'doc-1', modelId: 'm1', promptTemplateId: 'tpl-1', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z', priority: 'normal' })

    const r = await drainAll()
    expect(r.succeeded).toBe(3)
    // high priority job should be processed first (it gets the first chatMock call)
    // Since all 3 use the same doc, we check the order of conversation creation
    const jobs = await AiJobRepository.findAll()
    const highJob = jobs.find((j) => j.id === 'job-high')!
    const normalJob = jobs.find((j) => j.id === 'job-normal')!
    const lowJob = jobs.find((j) => j.id === 'job-low')!
    // Higher priority jobs should have earlier finishedAt
    expect(new Date(highJob.finishedAt!).getTime()).toBeLessThanOrEqual(new Date(normalJob.finishedAt!).getTime())
    expect(new Date(normalJob.finishedAt!).getTime()).toBeLessThanOrEqual(new Date(lowJob.finishedAt!).getTime())
  })

  it('cancelJob marks a job cancelled and aborts the in-flight request', async () => {
    let abortSignal: AbortSignal | undefined
    chatMock.mockImplementation(async (input: any) => {
      abortSignal = input.signal
      // Simulate a long-running request that gets aborted mid-flight
      await new Promise((_, reject) => {
        input.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
      return { content: 'never', usage: { totalTokens: 1 } }
    })

    await AiJobRepository.save({
      id: 'job-c', documentId: 'doc-1', modelId: 'm1', promptTemplateId: 'tpl-1',
      status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z',
    })

    // Kick off drain, cancel once the request is in flight
    const drainPromise = drainAll()
    // Wait for chatMock to register the signal (request has started → job is processing)
    await vi.waitFor(() => expect(abortSignal).toBeDefined())
    await cancelJob('job-c')
    const r = await drainPromise

    expect(r.cancelled).toBe(1)
    expect(r.succeeded).toBe(0)
    const job = await AiJobRepository.findById('job-c')
    expect(job?.status).toBe('cancelled')
    expect(job?.cancelRequested).toBe(true)
    expect(abortSignal?.aborted).toBe(true)
  })

  it('reclaimStaleJobs flips stuck processing jobs to failed', async () => {
    await AiJobRepository.save({
      id: 'job-stuck', documentId: 'doc-1', modelId: 'm1', promptTemplateId: 'tpl-1',
      status: 'processing', retries: 0, createdAt: '2026-01-01T00:00:00Z',
    })
    const count = await reclaimStaleJobs()
    expect(count).toBe(1)
    const job = await AiJobRepository.findById('job-stuck')
    expect(job?.status).toBe('failed')
    expect(job?.error).toContain('中断')
  })

  it('workflow chains: next step is enqueued after the previous step succeeds', async () => {
    chatMock.mockResolvedValue({ content: 'step result', usage: { totalTokens: 1 } })

    // Define a 2-step workflow
    await db.workflows.put({
      id: 'wf-1',
      name: '2-step',
      description: '',
      enabled: true,
      priority: 'normal',
      steps: [
        { id: 's1', templateId: 'tpl-1', modelId: 'm1', label: 'first' },
        { id: 's2', templateId: 'tpl-1', modelId: 'm1', label: 'second' },
      ],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })

    const { enqueueWorkflow } = await import('./queue')
    const res = await enqueueWorkflow({ documentIds: ['doc-1'], workflowId: 'wf-1' })
    expect(res.enqueuedDocs).toBe(1)

    // First drain runs step 0 and enqueues step 1
    const r1 = await drainAll()
    expect(r1.succeeded).toBe(1)
    const jobsAfterFirst = await AiJobRepository.findAll()
    expect(jobsAfterFirst.length).toBe(2)
    const step0 = jobsAfterFirst.find((j) => j.workflowStepIndex === 0)!
    const step1 = jobsAfterFirst.find((j) => j.workflowStepIndex === 1)!
    expect(step0.status).toBe('success')
    expect(step1.status).toBe('pending')
    expect(step0.workflowRunId).toBe(step1.workflowRunId)

    // Second drain runs step 1; no step 2 is enqueued
    const r2 = await drainAll()
    expect(r2.succeeded).toBe(1)
    const jobsAfterSecond = await AiJobRepository.findAll()
    expect(jobsAfterSecond.length).toBe(2) // no third job spawned
    expect(jobsAfterSecond.find((j) => j.workflowStepIndex === 1)!.status).toBe('success')
  })
})
