import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import { enqueueForDocument } from './queue'
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
