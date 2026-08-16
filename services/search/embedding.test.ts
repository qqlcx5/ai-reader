import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../db/index'
import {
  cosine, embeddableText, fuseRankings, buildEmbeddingIndex, semanticRank, embeddingIndexStats,
  type EmbeddingConfig,
} from './embedding'
import type { DocumentEntity } from '../../types/document'

const CONFIG: EmbeddingConfig = { baseUrl: 'https://api.example.com/v1', apiKey: 'sk-test', model: 'emb-1' }

function doc(id: string, markdown = '正文内容', contentHash = id): DocumentEntity {
  const now = new Date().toISOString()
  return {
    id, url: `https://example.com/${id}`, title: `文档 ${id}`, markdown,
    wordCount: 1, tokenCount: 1, contentHash, extractionMethod: 'defuddle',
    source: 'library', capturedAt: now, updatedAt: now,
  } as DocumentEntity
}

/** Deterministic fake embeddings: docs sharing a keyword share a vector dim. */
function fakeEmbedResponder() {
  return vi.fn(async (_url: string, init: any) => {
    const body = JSON.parse(init.body)
    const vectors: number[][] = body.input.map((text: string) => {
      const v = new Array(8).fill(0)
      for (let i = 0; i < 8; i++) v[i] = text.includes(`kw${i}`) ? 1 : 0.01
      return v
    })
    return { ok: true, json: () => Promise.resolve({ data: vectors.map((embedding) => ({ embedding })) }) }
  })
}

describe('cosine', () => {
  it('scores identical vectors 1, orthogonal 0, opposite -1', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1)
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1)
    expect(cosine([0, 0], [1, 1])).toBe(0)
  })
})

describe('embeddableText', () => {
  it('joins title and budgeted markdown', () => {
    const text = embeddableText('标题', '正文'.repeat(5000))
    expect(text.startsWith('标题')).toBe(true)
    expect(text.length).toBeLessThan(20000)
  })
})

describe('fuseRankings', () => {
  it('fuses two rankings with RRF and caps at k', () => {
    const fused = fuseRankings([
      ['a', 'b', 'c'],
      ['b', 'd'],
    ], 3)
    // b appears in both lists → tops the fusion
    expect(fused[0]).toBe('b')
    expect(fused).toHaveLength(3)
  })

  it('handles empty rankings', () => {
    expect(fuseRankings([], 3)).toEqual([])
    expect(fuseRankings([[], ['x']], 3)).toEqual(['x'])
  })
})

describe('buildEmbeddingIndex + semanticRank', () => {
  beforeEach(async () => {
    await db.documents.clear()
    await db.embeddings.clear()
    await db.kvMeta.clear()
  })

  it('embeds stale docs in batches, re-embeds edited docs, drops dead rows', async () => {
    const fetchMock = fakeEmbedResponder()
    vi.stubGlobal('fetch', fetchMock)

    await db.documents.bulkPut([
      doc('a', 'kw0 内容'),
      doc('b', 'kw1 内容'),
      doc('c', 'kw2 内容'),
    ])
    let embedded = await buildEmbeddingIndex(CONFIG)
    expect(embedded).toBe(3)
    expect(fetchMock).toHaveBeenCalledTimes(1) // one batch of ≤16

    let stats = await embeddingIndexStats()
    expect(stats).toEqual({ fresh: 3, total: 3 })

    // Edit doc a → only it re-embeds.
    await db.documents.put(doc('a', 'kw0 改动后', 'hash-a2'))
    embedded = await buildEmbeddingIndex(CONFIG)
    expect(embedded).toBe(1)
    stats = await embeddingIndexStats()
    expect(stats.fresh).toBe(3)

    // Delete a doc → its vector row is cleaned.
    await db.documents.delete('c')
    await buildEmbeddingIndex(CONFIG)
    expect(await db.embeddings.count()).toBe(2)
    vi.unstubAllGlobals()
  })

  it('semanticRank orders by cosine similarity to the query', async () => {
    vi.stubGlobal('fetch', fakeEmbedResponder())
    await db.documents.bulkPut([doc('a', 'kw0 甲'), doc('b', 'kw1 乙')])
    await buildEmbeddingIndex(CONFIG)

    const ranked = await semanticRank('kw0 问题', CONFIG, 4)
    expect(ranked[0]).toBe('a')
    expect(ranked).not.toContain('missing')
    vi.unstubAllGlobals()
  })
})
