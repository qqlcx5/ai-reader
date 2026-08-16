/**
 * Dead-link scan: HEAD (fallback GET) the stored URLs, batched and
 * best-effort. Extension host permissions make cross-origin checks possible.
 */
import type { DocumentEntity } from '@/types/document'

export interface LinkCheckResult {
  docId: string
  url: string
  title: string
  ok: boolean
  status?: number
  error?: string
}

/** Check one URL with a timeout (pure-ish; fetch injected for tests). */
export async function checkLink(
  url: string,
  timeoutMs = 8000,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!url.startsWith('http')) return { ok: true } // inbox:// digest:// etc.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let res = await fetchImpl(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal })
    if (res.status === 405 || res.status === 501) {
      res = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal: controller.signal })
    }
    // 4xx/5xx = dead; 401/403 paywalls are still "alive" pages.
    if (res.status === 401 || res.status === 403) return { ok: true, status: res.status }
    return { ok: res.ok, status: res.status }
  } catch (e: any) {
    return { ok: false, error: e?.name === 'AbortError' ? '超时' : '无法连接' }
  } finally {
    clearTimeout(timer)
  }
}

/** Scan up to `limit` unique URLs (oldest first), reporting progress. */
export async function scanDeadLinks(
  docs: DocumentEntity[],
  onProgress?: (done: number, total: number) => void,
  limit = 30,
  fetchImpl: typeof fetch = fetch,
): Promise<LinkCheckResult[]> {
  const seen = new Set<string>()
  const targets: DocumentEntity[] = []
  for (const doc of [...docs].sort((a, b) => (a.capturedAt || '').localeCompare(b.capturedAt || ''))) {
    if (!doc.url.startsWith('http') || seen.has(doc.url)) continue
    seen.add(doc.url)
    targets.push(doc)
    if (targets.length >= limit) break
  }

  const results: LinkCheckResult[] = []
  for (let i = 0; i < targets.length; i++) {
    const doc = targets[i]
    const r = await checkLink(doc.url, 8000, fetchImpl)
    results.push({ docId: doc.id, url: doc.url, title: doc.title || doc.url, ok: r.ok, status: r.status, error: r.error })
    onProgress?.(i + 1, targets.length)
  }
  return results
}
