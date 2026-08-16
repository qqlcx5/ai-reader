import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildChangeMaterial, summarizeChange, annotateLatestChange } from './summarize'
import { db } from '../../db/index'
import type { PageWatchEntity } from '../../types/page-watch'
import type { AIProvider } from '@/services/ai/types'
import type { ModelConfig } from '@/types/model'

const model: ModelConfig = {
  id: 'm1', provider: 'openai-compatible', modelId: 'gpt-test', name: 'M', enabled: true,
} as unknown as ModelConfig

function fakeProvider(content: string): AIProvider {
  return {
    chat: vi.fn().mockResolvedValue({ content }),
    streamChat: vi.fn(),
    testConnection: vi.fn(),
  } as unknown as AIProvider
}

describe('buildChangeMaterial', () => {
  it('labels old and new excerpts and caps length', () => {
    const material = buildChangeMaterial('旧内容', '新内容'.repeat(1000))
    expect(material).toContain('【旧版摘录】')
    expect(material).toContain('旧内容')
    expect(material).toContain('【新版摘录】')
    expect(material.length).toBeLessThan(3300)
  })
})

describe('summarizeChange', () => {
  it('returns the trimmed summary', async () => {
    const summary = await summarizeChange('旧', '新', model, fakeProvider('  价格从 99 降到 79。  '))
    expect(summary).toBe('价格从 99 降到 79。')
  })

  it('returns null on provider failure or empty output', async () => {
    const failing = {
      chat: vi.fn().mockRejectedValue(new Error('boom')),
      streamChat: vi.fn(),
      testConnection: vi.fn(),
    } as unknown as AIProvider
    expect(await summarizeChange('旧', '新', model, failing)).toBeNull()
    expect(await summarizeChange('旧', '新', model, fakeProvider('   '))).toBeNull()
  })
})

describe('annotateLatestChange', () => {
  beforeEach(async () => {
    await db.pageWatches.clear()
    await db.models.clear()
    await db.models.put({ id: 'm1', provider: 'openai-compatible', modelId: 'gpt', name: 'M', enabled: true, isDefault: true } as any)
  })

  it('fills the summary on the latest change and persists it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: '价格从 99 降到 79。' } }] }),
    }))
    const watch: PageWatchEntity = {
      id: 'w1', url: 'https://example.com', title: 'T', enabled: true,
      lastMarkdownExcerpt: '新版内容：价格 79 元',
      changes: [{ at: '2025-06-15T00:00:00Z', hash: 'h2', previousExcerpt: '旧版内容：价格 99 元' }],
      createdAt: '', updatedAt: '',
    }
    const updated = await annotateLatestChange(watch)
    expect(updated?.changes?.[0].summary).toBe('价格从 99 降到 79。')
    expect((await db.pageWatches.get('w1'))?.changes?.[0]?.summary).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('skips watches without material or with existing summaries', async () => {
    const noMaterial: PageWatchEntity = {
      id: 'w2', url: 'https://example.com', title: 'T', enabled: true,
      changes: [{ at: '', hash: 'h', previousExcerpt: 'x' }], // no lastMarkdownExcerpt
      createdAt: '', updatedAt: '',
    }
    expect(await annotateLatestChange(noMaterial)).toBeNull()

    const summarized: PageWatchEntity = {
      id: 'w3', url: 'https://example.com', title: 'T', enabled: true,
      lastMarkdownExcerpt: '新',
      changes: [{ at: '', hash: 'h', previousExcerpt: '旧', summary: '已有摘要' }],
      createdAt: '', updatedAt: '',
    }
    expect(await annotateLatestChange(summarized)).toBeNull()
  })
})
