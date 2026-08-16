import { describe, it, expect, vi } from 'vitest'
import { checkLink, scanDeadLinks } from './deadlinks'
import type { DocumentEntity } from '../../types/document'

function doc(id: string, url: string): DocumentEntity {
  const now = new Date().toISOString()
  return {
    id, url, title: `文档 ${id}`, markdown: 'x', wordCount: 1, tokenCount: 1,
    contentHash: id, extractionMethod: 'defuddle', source: 'library',
    capturedAt: now, updatedAt: now,
  } as DocumentEntity
}

function fetchByStatus(map: Record<string, number>) {
  return vi.fn(async (url: string, init?: any) => {
    const status = map[url] ?? 200
    return { ok: status < 400, status }
  }) as unknown as typeof fetch
}

describe('checkLink', () => {
  it('treats 2xx alive, 404 dead, and paywalls (401/403) alive', async () => {
    const f = fetchByStatus({ 'https://a.com': 200, 'https://b.com': 404, 'https://c.com': 403 })
    expect((await checkLink('https://a.com', 100, f)).ok).toBe(true)
    expect((await checkLink('https://b.com', 100, f)).ok).toBe(false)
    expect((await checkLink('https://c.com', 100, f)).ok).toBe(true)
  })

  it('retries GET when HEAD is rejected (405) and skips non-http urls', async () => {
    const f = vi.fn(async (url: string, init?: any) => ({ ok: init?.method === 'GET', status: init?.method === 'GET' ? 200 : 405 })) as unknown as typeof fetch
    expect((await checkLink('https://a.com', 100, f)).ok).toBe(true)
    expect((await checkLink('inbox://x', 100, f)).ok).toBe(true)
  })

  it('reports timeouts as errors', async () => {
    const hanging = vi.fn((_u: string, init?: any) => new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch
    const r = await checkLink('https://slow.com', 50, hanging)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('超时')
  })
})

describe('scanDeadLinks', () => {
  it('dedupes urls, caps at limit, and reports progress', async () => {
    const f = fetchByStatus({ 'https://a.com/1': 404 })
    const docs = [
      doc('1', 'https://a.com/1'),
      doc('1-dup', 'https://a.com/1'),
      doc('2', 'inbox://skip'),
      doc('3', 'https://a.com/3'),
    ]
    const progress: string[] = []
    const results = await scanDeadLinks(docs, (d, t) => progress.push(`${d}/${t}`), 30, f)
    expect(results).toHaveLength(2) // deduped + non-http skipped
    expect(results.find((r) => r.url === 'https://a.com/1')?.ok).toBe(false)
    expect(progress).toEqual(['1/2', '2/2'])
  })
})
