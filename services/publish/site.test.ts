import { describe, it, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { buildSiteZip, buildIndexHtml, buildDocHtml } from './site'
import type { DocumentEntity } from '@/types/document'

function doc(id: string, title: string, capturedAt: string, opts: Partial<DocumentEntity> = {}): DocumentEntity {
  return {
    id, url: `https://example.com/${id}`, title, markdown: `# ${title}\n\n正文 **加粗** 与 [链接](https://a.com)。`,
    wordCount: 10, tokenCount: 10, contentHash: id, siteName: '站点',
    extractionMethod: 'defuddle', source: 'library', capturedAt, updatedAt: capturedAt, ...opts,
  } as DocumentEntity
}

describe('buildDocHtml', () => {
  it('renders markdown to HTML with metadata, tags, and back link', () => {
    const html = buildDocHtml(doc('a', '文章 A', '2025-06-01T00:00:00Z', { tags: ['AI'], author: '作者' }), '../index.html')
    expect(html).toContain('<title>文章 A</title>')
    expect(html).toContain('<h1>文章 A</h1>')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('href="https://a.com"')
    expect(html).toContain('站点 · 作者 · 2025-06-01')
    expect(html).toContain('class="tag">AI<')
    expect(html).toContain('href="../index.html"')
    // Original-source link for http docs
    expect(html).toContain('查看原文')
    // No unsanitized script passthrough
    expect(html).not.toContain('<script>alert')
  })

  it('escapes html in titles', () => {
    const html = buildDocHtml(doc('a', '<img onerror=alert(1)>', '2025-06-01T00:00:00Z'), '../index.html')
    expect(html).toContain('&lt;img onerror=alert(1)&gt;')
  })
})

describe('buildIndexHtml', () => {
  it('groups by month, newest first, links to doc pages', () => {
    const docs = [
      doc('a', '旧文', '2025-04-01T00:00:00Z'),
      doc('b', '新文', '2025-06-01T00:00:00Z', { title: '新文' }),
    ]
    const files = new Map([['a', 'docs/a.html'], ['b', 'docs/b.html']])
    const html = buildIndexHtml(docs, files, '2025-06-15T00:00:00Z')
    const juneIdx = html.indexOf('2025-06')
    const aprilIdx = html.indexOf('2025-04</h2>')
    expect(juneIdx).toBeGreaterThan(-1)
    expect(aprilIdx).toBeGreaterThan(-1)
    expect(juneIdx).toBeLessThan(aprilIdx)
    expect(html).toContain('href="docs/a.html"')
    expect(html).toContain('2 篇文档')
  })
})

describe('buildSiteZip', () => {
  it('produces index + one page per doc, deduping filenames', async () => {
    const docs = [
      doc('a', '同题', '2025-06-01T00:00:00Z'),
      doc('b', '同题', '2025-06-02T00:00:00Z'),
    ]
    const blob = buildSiteZip(docs)
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const names = Object.keys(files).sort()
    // Paths are URL-encoded for safe hosting; duplicates get a -2 suffix.
    expect(names).toEqual(['docs/%E5%90%8C%E9%A2%98-2.html', 'docs/%E5%90%8C%E9%A2%98.html', 'index.html', 'search.html'])
    const index = strFromU8(files['index.html'])
    expect(index).toContain('docs/%E5%90%8C%E9%A2%98-2.html')
    expect(index).toContain('docs/%E5%90%8C%E9%A2%98.html')
    expect(strFromU8(files['docs/%E5%90%8C%E9%A2%98.html'])).toContain('返回目录')
  })

  it('embeds a self-contained search page with the docs index', async () => {
    const docs = [doc('a', '注意力机制详解', '2025-06-01T00:00:00Z', { excerpt: '自注意力是核心' })]
    const blob = buildSiteZip(docs)
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const search = strFromU8(files['search.html'])
    expect(search).toContain('1 篇文档的本地全文索引')
    expect(search).toContain('"t":"注意力机制详解"')
    expect(search).toContain('自注意力是核心')
    expect(search).toContain('DOCS')
    // No unresolved placeholder
    expect(search).not.toContain('__DOCS_INDEX__')
  })
})
