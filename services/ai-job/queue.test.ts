import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import { enqueueForDocument, enqueueBatch } from './queue'
import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import type { AppSettings } from '@/types/settings'

async function resetDB() {
  await Promise.all([db.documents, db.models, db.settings, db.kvMeta, db.aiJobs].map((t) => t.clear()))
}

function settings(over: Partial<AppSettings['autoAnalysis']> = {}): AppSettings {
  return {
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
    autoAnalysis: { enabled: true, modelId: 'm1', promptTemplateId: 'tpl-1', ...over },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('enqueueForDocument', () => {
  beforeEach(async () => {
    await resetDB()
    await db.documents.put({
      id: 'doc-1',
      url: 'https://x',
      title: 'T',
      markdown: 'm',
      wordCount: 1,
      tokenCount: 1,
      contentHash: 'h',
      extractionMethod: 'manual',
      source: 'library',
      capturedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
  })

  it('enqueues a pending job when enabled + configured', async () => {
    await enqueueForDocument('doc-1', settings())
    const jobs = await AiJobRepository.findByDocument('doc-1')
    expect(jobs).toHaveLength(1)
    expect(jobs[0].status).toBe('pending')
    expect(jobs[0].documentTitle).toBe('T')
  })

  it('does not duplicate (one job per document)', async () => {
    await enqueueForDocument('doc-1', settings())
    await enqueueForDocument('doc-1', settings())
    expect(await AiJobRepository.findByDocument('doc-1')).toHaveLength(1)
  })

  it('is a no-op when disabled', async () => {
    await enqueueForDocument('doc-1', settings({ enabled: false }))
    expect(await AiJobRepository.findByDocument('doc-1')).toHaveLength(0)
  })

  it('is a no-op when no template configured', async () => {
    await enqueueForDocument('doc-1', settings({ promptTemplateId: undefined }))
    expect(await AiJobRepository.findByDocument('doc-1')).toHaveLength(0)
  })
})

describe('enqueueBatch', () => {
  beforeEach(async () => {
    await resetDB()
    for (const id of ['doc-a', 'doc-b', 'doc-c']) {
      await db.documents.put({
        id,
        url: `https://${id}`,
        title: `Title ${id}`,
        markdown: 'm',
        wordCount: 1,
        tokenCount: 1,
        contentHash: 'h',
        extractionMethod: 'manual',
        source: 'library',
        capturedAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      })
    }
  })

  it('enqueues jobs for all provided documents', async () => {
    const result = await enqueueBatch({
      documentIds: ['doc-a', 'doc-b', 'doc-c'],
      modelId: 'm1',
      promptTemplateId: 'tpl-1',
    })
    expect(result.enqueued).toBe(3)
    expect(result.skipped).toBe(0)
    expect(result.batchId).toBeTruthy()
    const all = await AiJobRepository.findAll()
    expect(all).toHaveLength(3)
    expect(all.every((j) => j.status === 'pending')).toBe(true)
    expect(all.every((j) => j.batchId === result.batchId)).toBe(true)
    expect(all.every((j) => j.jobSource === 'manual')).toBe(true)
  })

  it('skips non-existent documents', async () => {
    const result = await enqueueBatch({
      documentIds: ['doc-a', 'ghost', 'doc-b'],
      modelId: 'm1',
    })
    expect(result.enqueued).toBe(2)
    expect(result.skipped).toBe(1)
  })

  it('respects explicit batchId', async () => {
    const result = await enqueueBatch({
      documentIds: ['doc-a'],
      modelId: 'm1',
      batchId: 'my-batch',
    })
    expect(result.batchId).toBe('my-batch')
  })

  it('allows duplicate jobs for same document (no dedupe)', async () => {
    await enqueueBatch({ documentIds: ['doc-a'], modelId: 'm1' })
    await enqueueBatch({ documentIds: ['doc-a'], modelId: 'm1' })
    expect(await AiJobRepository.findByDocument('doc-a')).toHaveLength(2)
  })

  it('works without a prompt template', async () => {
    const result = await enqueueBatch({
      documentIds: ['doc-a'],
      modelId: 'm1',
    })
    expect(result.enqueued).toBe(1)
    const jobs = await AiJobRepository.findByDocument('doc-a')
    expect(jobs[0].promptTemplateId).toBe('')
  })

  it('returns zero when no documents provided', async () => {
    const result = await enqueueBatch({ documentIds: [], modelId: 'm1' })
    expect(result.enqueued).toBe(0)
    expect(result.batchId).toBeTruthy()
  })

  it('sets priority on enqueued jobs', async () => {
    await enqueueBatch({ documentIds: ['doc-a', 'doc-b'], modelId: 'm1', priority: 'high' })
    const jobs = await AiJobRepository.findAll()
    expect(jobs.every((j) => j.priority === 'high')).toBe(true)
  })

  it('defaults to normal priority when not specified', async () => {
    await enqueueBatch({ documentIds: ['doc-a'], modelId: 'm1' })
    const jobs = await AiJobRepository.findAll()
    expect(jobs[0].priority).toBe('normal')
  })
})
