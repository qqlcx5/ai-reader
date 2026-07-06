import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/db'

const chatMock = vi.fn(async () => ({ content: 'AI 摘要内容', usage: { totalTokens: 42 } }))
vi.mock('@/services/ai/factory', () => ({
  createProvider: () => ({ chat: chatMock }),
}))

import { drainAll } from './processor'
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
})
