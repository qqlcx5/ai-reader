import { describe, it, expect } from 'vitest'
import { findRelated, bigrams } from './related'
import type { DocumentEntity } from '@/types/document'

function makeDoc(id: string, title: string, markdown = '', excerpt = ''): DocumentEntity {
  const now = new Date().toISOString()
  return {
    id, url: `https://example.com/${id}`, title, markdown, excerpt,
    wordCount: 10, tokenCount: 10, contentHash: id,
    extractionMethod: 'defuddle', source: 'library', capturedAt: now, updatedAt: now,
  } as DocumentEntity
}

describe('bigrams', () => {
  it('splits text into character bigrams, case/space-normalized', () => {
    expect(bigrams('AB C')).toEqual(new Set(['ab', 'b ', ' c']))
    expect(bigrams('间隔')).toEqual(new Set(['间隔']))
  })
})

describe('findRelated', () => {
  const target = makeDoc('t', 'Transformer 架构详解', 'Transformer 是一种基于自注意力机制的神经网络架构，使用多头注意力。')
  const pool = [
    makeDoc('a', 'Transformer 注意力机制入门', '自注意力机制是 Transformer 的核心，多头注意力是其实现方式之一。'),
    makeDoc('b', '今天的菜谱', '红烧肉的做法，先焯水再炖煮。'),
    makeDoc('c', 'RNN 与循环神经网络', '循环神经网络按时间步展开。'),
  ]

  it('ranks the topically similar document first', () => {
    const related = findRelated(target, pool)
    expect(related.length).toBeGreaterThan(0)
    expect(related[0].doc.id).toBe('a')
    // Unrelated cooking doc doesn't make the cut.
    expect(related.find((r) => r.doc.id === 'b')).toBeUndefined()
  })

  it('excludes the target itself and respects the limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => makeDoc(`x${i}`, `Transformer 变体 ${i} 号`, '自注意力机制 多头注意力 Transformer'))
    const related = findRelated(target, [...many, target], 5)
    expect(related.every((r) => r.doc.id !== 't')).toBe(true)
    expect(related.length).toBeLessThanOrEqual(5)
  })

  it('returns empty for an empty pool or empty signature', () => {
    expect(findRelated(target, [])).toEqual([])
    expect(findRelated(makeDoc('e', '', ''), [target])).toEqual([])
  })
})
