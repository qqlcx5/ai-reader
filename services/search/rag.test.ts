import { describe, it, expect, beforeEach } from 'vitest'
import { retrieveKnowledge, PER_DOC_TOKENS } from './rag'
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
})
