import { describe, it, expect, beforeEach } from 'vitest'
import { retrieveKnowledge, rerankByBigram, PER_DOC_TOKENS } from './rag'
import { db } from '../../db/index'
import { initSearchIndex } from './index'
import { estimateTokens } from '@/utils/token'
import type { DocumentEntity } from '../../types/document'

function makeDoc(id: string, title: string, markdown: string): DocumentEntity {
  const now = new Date().toISOString()
  return {
    id, url: `https://example.com/${id}`, title, markdown,
    wordCount: 10, tokenCount: 10, contentHash: id,
    extractionMethod: 'defuddle', source: 'library', siteName: `site-${id}`,
    capturedAt: now, updatedAt: now,
  } as DocumentEntity
}

describe('rerankByBigram', () => {
  it('prefers candidates sharing rare bigrams with the query', () => {
    const docs = [
      makeDoc('a', '机器学习概论', '泛泛而谈的入门介绍。'),
      makeDoc('b', 'Transformer 自注意力详解', '自注意力机制是 Transformer 的核心。'),
    ]
    const ranked = rerankByBigram('Transformer 自注意力机制', docs, 1)
    expect(ranked[0].id).toBe('b')
  })

  it('falls back to input order on empty queries and caps at k', () => {
    const docs = [makeDoc('a', 'A', 'x'), makeDoc('b', 'B', 'y')]
    expect(rerankByBigram('', docs, 1)[0].id).toBe('a')
    expect(rerankByBigram('任意词', docs, 1)).toHaveLength(1)
  })
})

describe('retrieveKnowledge', () => {
  beforeEach(async () => {
    await db.documents.clear()
    await initSearchIndex()
  })

  it('returns a numbered context with citations and sources', async () => {
    await db.documents.bulkPut([
      makeDoc('a', 'Transformer 入门', 'Transformer 是基于自注意力的架构，广泛应用于自然语言处理。'),
      makeDoc('b', '红烧肉做法', '五花肉焯水后炖煮四十分钟。'),
    ])
    await initSearchIndex()

    const { context, sources } = await retrieveKnowledge('什么是 Transformer 架构')
    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({ id: 'a', title: 'Transformer 入门', siteName: 'site-a' })
    expect(context).toContain('[1] 《Transformer 入门》')
    expect(context).toContain('site-a')
    expect(context).toContain('自注意力')
    expect(context).toContain('[编号]')
  })

  it('respects k and per-document token budget', async () => {
    const long = '深度学习模型训练。'.repeat(2000)
    await db.documents.bulkPut([
      makeDoc('a', '深度学习 A', long),
      makeDoc('b', '深度学习 B', long),
      makeDoc('c', '深度学习 C', long),
    ])
    await initSearchIndex()

    const { sources, context } = await retrieveKnowledge('深度学习 模型', 2, { perDocTokens: 100 })
    expect(sources.length).toBeLessThanOrEqual(2)
    const blocks = context.split('\n\n---\n\n')
    expect(blocks.length).toBeLessThanOrEqual(3) // header + 2 docs
    // Each doc block respects the budget (header line + body).
    for (const block of blocks.slice(1)) {
      expect(estimateTokens(block)).toBeLessThan(PER_DOC_TOKENS)
    }
  })

  it('excludes ids when asked and handles empty queries / no hits', async () => {
    await db.documents.put(makeDoc('a', 'Transformer 入门', '自注意力架构'))
    await initSearchIndex()

    const excluded = await retrieveKnowledge('Transformer', 4, { excludeIds: ['a'] })
    expect(excluded.sources).toEqual([])

    expect(await retrieveKnowledge('   ')).toEqual({ context: '', sources: [] })
    const miss = await retrieveKnowledge('量子力学')
    expect(miss.sources).toEqual([])
    expect(miss.context).toBe('')
  })

  it('scopes retrieval to a collection', async () => {
    await db.documents.bulkPut([
      makeDoc('a', 'Rust 异步 指南', 'async await 状态机。'),
      makeDoc('b', '红烧肉 烹饪 指南', '五花肉炖煮。'),
    ])
    await db.collections.put({ id: 'c1', name: '技术', createdAt: '', updatedAt: '' } as any)
    await db.collectionItems.bulkPut([
      { id: 'i1', collectionId: 'c1', documentId: 'a', order: 0 } as any,
    ])
    await initSearchIndex()

    const all = await retrieveKnowledge('指南', 4)
    expect(all.sources.map((s) => s.id).sort()).toEqual(['a', 'b'])

    const scoped = await retrieveKnowledge('指南', 4, { collectionId: 'c1' })
    expect(scoped.sources.map((s) => s.id)).toEqual(['a'])
  })
})
