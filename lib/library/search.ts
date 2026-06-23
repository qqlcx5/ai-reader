/**
 * M6 — lib/library/search.ts
 * 主线程 Worker 通信封装：search(query) → Promise<SearchResult[]>
 * debounce 300ms 防抖，避免输入时高频触发
 */

export interface SearchResult {
  pageId: string
  title: string
  snippet: string
  matchType: 'title' | 'article' | 'chat'
  domain?: string
  favicon?: string
  updatedAt?: number
}

interface WorkerResponse {
  ok: boolean
  results: SearchResult[]
  error?: string
}

// ─── Worker 单例（懒初始化） ──────────────────────────────────────────────────

let _worker: Worker | null = null

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(new URL('../../workers/search.worker.ts', import.meta.url), {
      type: 'module',
    })
  }
  return _worker
}

/** 终止并重建 Worker（错误恢复） */
function resetWorker(): void {
  _worker?.terminate()
  _worker = null
}

// ─── 请求 ID 管理（多并发请求对应） ─────────────────────────────────────────

let _reqId = 0
const _pending = new Map<number, { resolve: (r: SearchResult[]) => void; reject: (e: Error) => void }>()

function getWorkerWithListener(): Worker {
  const w = getWorker()
  // 只注册一次 onmessage
  if (!(w as Worker & { _msgBound?: boolean })._msgBound) {
    (w as Worker & { _msgBound?: boolean })._msgBound = true
    w.onmessage = (e: MessageEvent<WorkerResponse & { reqId?: number }>) => {
      const { reqId, ok, results, error } = e.data
      if (reqId === undefined) return
      const pending = _pending.get(reqId)
      if (!pending) return
      _pending.delete(reqId)
      if (ok) {
        pending.resolve(results)
      } else {
        pending.reject(new Error(error ?? 'Worker search error'))
      }
    }
    w.onerror = (e) => {
      console.error('[search.worker] error', e)
      resetWorker()
      // reject all pending
      for (const [, p] of _pending) {
        p.reject(new Error('Worker crashed'))
      }
      _pending.clear()
    }
  }
  return w
}

function searchRaw(query: string, limit = 50): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    const id = ++_reqId
    _pending.set(id, { resolve, reject })
    try {
      const w = getWorkerWithListener()
      w.postMessage({ query, limit, reqId: id })
    } catch (err) {
      _pending.delete(id)
      reject(err)
    }
  })
}

// ─── Debounce 包装（300ms） ───────────────────────────────────────────────────

let _debounceTimer: ReturnType<typeof setTimeout> | null = null
let _resolveDebounced: ((r: SearchResult[]) => void) | null = null

/**
 * 带 300ms 防抖的全文检索
 * 每次调用会取消上一次未执行的请求，返回最新查询的 Promise
 */
export function search(query: string, limit = 50): Promise<SearchResult[]> {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _resolveDebounced?.([] as SearchResult[])
  }

  return new Promise<SearchResult[]>((resolve) => {
    _resolveDebounced = resolve
    _debounceTimer = setTimeout(async () => {
      _debounceTimer = null
      _resolveDebounced = null
      if (!query.trim()) {
        resolve([])
        return
      }
      try {
        const results = await searchRaw(query, limit)
        resolve(results)
      } catch {
        resolve([])
      }
    }, 300)
  })
}

/** 立即执行搜索（无防抖，用于明确触发的操作） */
export async function searchImmediate(query: string, limit = 50): Promise<SearchResult[]> {
  if (!query.trim()) return []
  try {
    return await searchRaw(query, limit)
  } catch {
    return []
  }
}
