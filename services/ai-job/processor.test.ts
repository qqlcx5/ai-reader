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
    chatMock.mockClear()
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
    chatMock.mockRejectedValueOnce(new Error('rate limited'))
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
})
