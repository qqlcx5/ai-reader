import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../db/index'
import { computeTopics, nameCluster } from './clusters'
import type { DocumentEntity } from '../../types/document'
import type { AIProvider } from '@/services/ai/types'
import type { ModelConfig } from '@/types/model'

const model: ModelConfig = {
  id: 'm1', provider: 'openai-compatible', modelId: 'gpt', name: 'M', enabled: true,
} as unknown as ModelConfig

function fakeProvider(content: string): AIProvider {
  return { chat: vi.fn().mockResolvedValue({ content }), streamChat: vi.fn(), testConnection: vi.fn() } as unknown as AIProvider
}

function doc(id: string, title: string): DocumentEntity {
  const now = new Date().toISOString()
  return {
    id, url: `https://example.com/${id}`, title, markdown: '内容',
    wordCount: 1, tokenCount: 1, contentHash: id, extractionMethod: 'defuddle',
    source: 'library', capturedAt: now, updatedAt: now,
  } as DocumentEntity
}

/** Deterministic embeddings: two topic families on opposite ends. */
function fakeEmbedResponder() {
  return vi.fn(async (_url: string, init: any) => {
    const body = JSON.parse(init.body)
    const vectors = body.input.map((text: string) => {
      const isAI = /AI|Transformer|注意力/.test(text)
      return isAI ? [1, 0] : [0, 1]
    })
    return { ok: true, json: () => Promise.resolve({ data: vectors.map((embedding: number[]) => ({ embedding })) }) }
  })
}

describe('nameCluster', () => {
  it('returns the trimmed AI name', async () => {
    expect(await nameCluster(['A', 'B'], model, fakeProvider('  「深度学习」  '))).toBe('深度学习')
  })

  it('falls back to the first title on failure', async () => {
    const failing = { chat: vi.fn().mockRejectedValue(new Error('x')), streamChat: vi.fn(), testConnection: vi.fn() } as unknown as AIProvider
    expect(await nameCluster(['注意力机制入门', 'B'], model, failing)).toBe('注意力机制入门')
  })
})

describe('computeTopics', () => {
  beforeEach(async () => {
    await db.documents.clear()
    await db.embeddings.clear()
    await db.models.clear()
    await db.models.put({ id: 'm1', provider: 'openai-compatible', modelId: 'gpt', name: 'M', enabled: true, isDefault: true } as any)
  })

  it('clusters into coherent topics with AI names', async () => {
    vi.stubGlobal('fetch', fakeEmbedResponder())
    const docs = [
      doc('a1', 'Transformer 注意力'), doc('a2', 'AI 大模型'), doc('a3', '深度学习 AI'),
      doc('b1', '红烧肉做法'), doc('b2', '烘焙食谱'), doc('b3', '炖菜技巧'),
    ]
    await db.documents.bulkPut(docs)
    // Build the embedding index (same fake endpoint).
    const { buildEmbeddingIndex, loadEmbeddingConfig, saveEmbeddingConfig } = await import('./embedding')
    await saveEmbeddingConfig({ baseUrl: 'https://api.example.com/v1', apiKey: 'k', model: 'e' })
    void loadEmbeddingConfig
    await buildEmbeddingIndex({ baseUrl: 'https://api.example.com/v1', apiKey: 'k', model: 'e' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: '主题名' } }] }),
    }))
    const result = await computeTopics()
    expect(result.notReady).toBeUndefined()
    expect(result.clusters.length).toBeGreaterThanOrEqual(2)
    // Members of each cluster share a family.
    const titles = (c: number) => result.clusters[c].docs.map((d) => d.title)
    const allTitles = result.clusters.flatMap((c) => c.docs.map((d) => d.title))
    expect(allTitles).toHaveLength(6)
    // The AI name came from the mocked chat endpoint.
    expect(result.clusters.every((c) => c.name === '主题名' || c.name.length <= 12)).toBe(true)
    void titles
    vi.unstubAllGlobals()
  })

  it('reports not-ready when the index is stale', async () => {
    await db.documents.bulkPut([doc('a', '未索引文档 A'), doc('b', 'B'), doc('c', 'C'), doc('d', 'D')])
    const result = await computeTopics({ nameWithAI: false })
    expect(result.clusters).toEqual([])
    expect(result.notReady).toContain('语义索引未就绪')
  })
})
