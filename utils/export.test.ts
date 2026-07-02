import { describe, it, expect, vi } from 'vitest'
import { exportDocumentsToZip, downloadBlob } from './export'
import { unzipSync, strFromU8 } from 'fflate'
import type { DocumentEntity } from '@/types/document'

function makeDoc(overrides: Partial<DocumentEntity> = {}): DocumentEntity {
  const now = new Date().toISOString()
  return {
    id: 'doc-1',
    url: 'https://example.com/article',
    title: 'Test Article',
    markdown: '# Hello\n\nWorld',
    wordCount: 2,
    tokenCount: 3,
    contentHash: 'abc123',
    extractionMethod: 'defuddle',
    source: 'current-page',
    capturedAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('exportDocumentsToZip', () => {
  it('creates a ZIP with one .md file per document', () => {
    const docs = [
      makeDoc({ id: 'd1', title: 'First Post' }),
      makeDoc({ id: 'd2', title: 'Second Post' }),
    ]
    const blob = exportDocumentsToZip(docs)
    expect(blob.type).toBe('application/zip')

    // Parse the zip
    return blob.arrayBuffer().then((buf) => {
      const files = unzipSync(new Uint8Array(buf))
      const names = Object.keys(files).sort()
      expect(names).toHaveLength(2)
      expect(names[0]).toMatch(/^01-First Post\.md$/)
      expect(names[1]).toMatch(/^02-Second Post\.md$/)

      const content = strFromU8(files[names[0]])
      expect(content).toContain('# First Post')
      expect(content).toContain('https://example.com/article')
      expect(content).toContain('# Hello')
    })
  })

  it('deduplicates filenames when titles collide', () => {
    const docs = [
      makeDoc({ id: 'd1', title: 'Same Title' }),
      makeDoc({ id: 'd2', title: 'Same Title' }),
    ]
    const blob = exportDocumentsToZip(docs)
    return blob.arrayBuffer().then((buf) => {
      const files = unzipSync(new Uint8Array(buf))
      const names = Object.keys(files).sort()
      expect(names).toHaveLength(2)
      // Both should contain "Same Title" but with different names
      expect(names[0]).toMatch(/Same Title/)
      expect(names[1]).toMatch(/Same Title/)
      expect(names[0]).not.toBe(names[1])
    })
  })

  it('sanitizes unsafe filename characters', () => {
    const doc = makeDoc({ id: 'd1', title: 'a/b:c?d*e' })
    const blob = exportDocumentsToZip([doc])
    return blob.arrayBuffer().then((buf) => {
      const files = unzipSync(new Uint8Array(buf))
      const name = Object.keys(files)[0]
      expect(name).not.toMatch(/[/\\:*?"<>|]/)
    })
  })

  it('handles empty title', () => {
    const doc = makeDoc({ id: 'd1', title: '' })
    const blob = exportDocumentsToZip([doc])
    return blob.arrayBuffer().then((buf) => {
      const files = unzipSync(new Uint8Array(buf))
      const name = Object.keys(files)[0]
      expect(name).toMatch(/untitled/)
    })
  })

  it('includes metadata header in each file', () => {
    const doc = makeDoc({
      title: 'My Article',
      url: 'https://blog.example.com/post',
      author: 'Jane Doe',
      publishedAt: '2024-01-15T00:00:00Z',
    })
    const blob = exportDocumentsToZip([doc])
    return blob.arrayBuffer().then((buf) => {
      const files = unzipSync(new Uint8Array(buf))
      const content = strFromU8(Object.values(files)[0])
      expect(content).toContain('# My Article')
      expect(content).toContain('Source: https://blog.example.com/post')
      expect(content).toContain('Author: Jane Doe')
      expect(content).toContain('Published: 2024-01-15')
    })
  })
})

describe('downloadBlob', () => {
  it('creates an anchor element and triggers click', () => {
    const blob = new Blob(['test'], { type: 'text/plain' })
    // Mock URL.createObjectURL and revokeObjectURL
    const createUrl = vi.fn(() => 'blob:test')
    const revokeUrl = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: revokeUrl })

    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { click: clickSpy, href: '', download: '' } as any
      }
      return originalCreateElement.call(document, tag)
    })

    downloadBlob(blob, 'test.zip')
    expect(createUrl).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeUrl).toHaveBeenCalledWith('blob:test')

    vi.restoreAllMocks()
  })
})
