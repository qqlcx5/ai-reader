/**
 * Batch URL capture — paste a list of links (migration from read-later apps),
 * fetch each page in the background and extract via the offscreen document
 * (or local DOMParser on Firefox). No content script involved, so JS-heavy
 * pages may extract worse than a live clip — a per-URL error is reported
 * instead of aborting the batch.
 */
import dayjs from 'dayjs'
import { sendToOffscreen } from '@/services/offscreen/manager'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { addToIndex } from '@/services/search'
import type { DocumentEntity } from '@/types/document'
import type { ExtractedPageData } from '@/utils/content/extract'

/** Parse a pasted blob into a deduped http(s) URL list (pure). */
export function parseUrlList(text: string): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  for (const raw of text.split(/[\s,;]+/)) {
    const candidate = raw.trim().match(/https?:\/\/\S+$/i)?.[0] || raw.trim()
    if (!/^https?:\/\/\S+$/i.test(candidate)) continue
    if (seen.has(candidate)) continue
    seen.add(candidate)
    urls.push(candidate)
  }
  return urls.slice(0, 100)
}

export interface BatchResult {
  url: string
  ok: boolean
  title?: string
  documentId?: string
  error?: string
}

/** Fetch + extract one URL into a library document. */
export async function captureUrl(url: string): Promise<BatchResult> {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) return { url, ok: false, error: `HTTP ${res.status}` }
    const contentType = res.headers.get('content-type') || ''
    if (contentType && !contentType.includes('html') && !contentType.includes('xml')) {
      return { url, ok: false, error: `不支持的类型：${contentType.split(';')[0]}` }
    }
    const html = await res.text()
    const data = await sendToOffscreen<any>({ type: 'EXTRACT_HTML', html, url, meta: {} })
    if (!data?.ok || !data.data?.markdown?.trim()) {
      return { url, ok: false, error: '无法提取正文（页面可能需要 JS 渲染）' }
    }
    const extracted = data.data as ExtractedPageData
    const now = dayjs().toISOString()
    const entity: DocumentEntity = {
      id: extracted.contentHash,
      url,
      title: extracted.title || url,
      markdown: extracted.markdown,
      wordCount: extracted.wordCount,
      tokenCount: extracted.tokenCount,
      contentHash: extracted.contentHash,
      extractionMethod: extracted.extractionMethod,
      source: 'library',
      capturedAt: now,
      updatedAt: now,
    }
    const saved = await DocumentRepository.save(entity)
    try {
      addToIndex(saved)
    } catch {
      // best-effort
    }
    return { url, ok: true, title: saved.title, documentId: saved.id }
  } catch (e: any) {
    return { url, ok: false, error: e?.message || '请求失败' }
  }
}

/**
 * Capture a list of URLs sequentially with progress. Stops early after 6
 * consecutive network failures (the site or the network is down — the rest
 * would almost certainly fail too).
 */
export async function captureUrls(
  urls: string[],
  onProgress?: (done: number, total: number, last: BatchResult) => void,
): Promise<BatchResult[]> {
  const results: BatchResult[] = []
  let consecutiveFailures = 0
  for (let i = 0; i < urls.length; i++) {
    const result = await captureUrl(urls[i])
    results.push(result)
    consecutiveFailures = result.ok ? 0 : consecutiveFailures + 1
    onProgress?.(i + 1, urls.length, result)
    if (consecutiveFailures >= 6 && i < urls.length - 1) {
      break
    }
  }
  return results
}
