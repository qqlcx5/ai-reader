import { describe, it, expect, beforeEach } from 'vitest'
import { buildQuickNote, saveQuickNote } from './quick-note'
import { db } from '../../db/index'

describe('buildQuickNote', () => {
  it('builds a quote-style markdown document with stable hash id', async () => {
    const doc = await buildQuickNote({
      selection: '第一行\n第二行',
      pageUrl: 'https://example.com/post',
      pageTitle: '好文章',
    })
    expect(doc.title).toBe('好文章 · 选段')
    expect(doc.markdown).toContain('> 第一行')
    expect(doc.markdown).toContain('> 第二行')
    expect(doc.markdown).toContain('[查看原文](https://example.com/post)')
    expect(doc.tags).toEqual(['quick-note'])
    expect(doc.extractionMethod).toBe('manual')
    expect(doc.id).toBe(doc.contentHash)

    // Same selection → same id (dedup)
    const doc2 = await buildQuickNote({
      selection: '第一行\n第二行',
      pageUrl: 'https://example.com/post',
      pageTitle: '好文章',
    })
    expect(doc2.id).toBe(doc.id)
  })
})

describe('saveQuickNote', () => {
  beforeEach(async () => {
    await db.documents.clear()
  })

  it('persists the note', async () => {
    const saved = await saveQuickNote({
      selection: '一段值得留住的文字',
      pageUrl: 'https://example.com/a',
      pageTitle: '页面',
    })
    expect(await db.documents.get(saved.id)).toBeTruthy()
  })
})
