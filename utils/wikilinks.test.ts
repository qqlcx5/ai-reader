import { describe, it, expect } from 'vitest'
import { extractWikilinks, normalizeTitle, buildLinkGraph } from './wikilinks'
import type { DocumentEntity } from '@/types/document'

function makeDoc(id: string, title: string, markdown = '', notes: string[] = []): DocumentEntity {
  const now = new Date().toISOString()
  return {
    id,
    url: `https://example.com/${id}`,
    title,
    markdown,
    wordCount: 10,
    tokenCount: 10,
    contentHash: id,
    extractionMethod: 'defuddle',
    source: 'library',
    capturedAt: now,
    updatedAt: now,
    highlights: notes.map((note, i) => ({
      id: `${id}-h${i}`, startOffset: 0, endOffset: 1, text: 'x', note, createdAt: now, updatedAt: now,
    })),
  } as DocumentEntity
}

describe('extractWikilinks', () => {
  it('extracts plain and labelled links', () => {
    const links = extractWikilinks('看 [[目标文档]] 和 [[另一篇|显示名]]')
    expect(links).toEqual([
      { target: '目标文档', label: '目标文档' },
      { target: '另一篇', label: '显示名' },
    ])
  })

  it('ignores empty targets and single brackets', () => {
    expect(extractWikilinks('[[ ]] 普通 [链接](https://a)')).toEqual([])
    expect(extractWikilinks('a [b] c')).toEqual([])
  })

  it('finds multiple links on one line and across lines', () => {
    const links = extractWikilinks('[[A]] 中间 [[B]]\n下一行 [[C]]')
    expect(links.map((l) => l.target)).toEqual(['A', 'B', 'C'])
  })
})

describe('normalizeTitle', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(normalizeTitle('  Hello   World ')).toBe(normalizeTitle('hello world'))
  })
})

describe('buildLinkGraph', () => {
  it('resolves titles to document edges', () => {
    const docs = [
      makeDoc('a', '笔记一', '引用了 [[笔记二]]'),
      makeDoc('b', '笔记二', '反过来提 [[笔记一]]'),
      makeDoc('c', '孤岛'),
    ]
    const g = buildLinkGraph(docs)
    expect(g.nodes.filter((n) => !n.ghost)).toHaveLength(3)
    expect(g.edges).toContainEqual({ source: 'a', target: 'b' })
    expect(g.edges).toContainEqual({ source: 'b', target: 'a' })
    const a = g.nodes.find((n) => n.id === 'a')!
    expect(a.outDegree).toBe(1)
    expect(a.inDegree).toBe(1)
  })

  it('reads links from highlight notes too', () => {
    const docs = [
      makeDoc('a', 'A', '', ['见 [[B]]']),
      makeDoc('b', 'B'),
    ]
    const g = buildLinkGraph(docs)
    expect(g.edges).toContainEqual({ source: 'a', target: 'b' })
  })

  it('creates ghost nodes for unresolved targets', () => {
    const docs = [makeDoc('a', 'A', '去 [[不存在的文档]]')]
    const g = buildLinkGraph(docs)
    const ghost = g.nodes.find((n) => n.ghost)
    expect(ghost?.title).toBe('不存在的文档')
    expect(g.edges).toContainEqual({ source: 'a', target: ghost!.id })
    expect(g.nodes.find((n) => n.id === 'a')!.outDegree).toBe(1)
  })

  it('matches titles case-insensitively and skips self-loops', () => {
    const docs = [makeDoc('a', 'Hello World', 'see [[hello   world]] and [[Hello World]]')]
    const g = buildLinkGraph(docs)
    expect(g.edges).toHaveLength(0) // both resolve to itself
    expect(g.nodes.find((n) => n.id === 'a')!.outDegree).toBe(0)
  })

  it('dedupes repeated edges between the same pair', () => {
    const docs = [
      makeDoc('a', 'A', '[[B]] 然后 [[B]]'),
      makeDoc('b', 'B'),
    ]
    const g = buildLinkGraph(docs)
    expect(g.edges).toHaveLength(1)
    expect(g.nodes.find((n) => n.id === 'a')!.outDegree).toBe(1) // deduped for degree too
  })
})
