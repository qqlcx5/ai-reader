/**
 * 搜索索引协调器 - 主线程与 Web Worker 通信
 * 参考 doc/tasks/search.md 章节 2, 3, 5
 * 实际 Worker 在 workers/search.worker.ts
 */
import type { SearchResult } from '@/shared/types';
import { getDocument } from '@/db/document-repository';

let worker: Worker | null = null;
let indexReady = false;
const readyPromise: { resolve?: () => void; reject?: (err: Error) => void } = {};

function ensureWorker(): Worker {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../../workers/search.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (e: MessageEvent) => {
      const { type } = e.data || {};
      if (type === 'INDEX_READY') {
        indexReady = true;
        readyPromise.resolve?.();
      }
    });
    worker.addEventListener('error', (e) => {
      console.error('[SearchWorker] error:', e);
      readyPromise.reject?.(new Error(e.message || 'Worker error'));
    });
  } catch (err) {
    console.error('[SearchWorker] failed to create:', err);
    throw err;
  }
  return worker;
}

/**
 * 初始化索引
 */
export async function initIndex(): Promise<void> {
  ensureWorker();
  if (indexReady) return;
  worker?.postMessage({ type: 'INIT_INDEX' });
  await new Promise<void>((resolve, reject) => {
    readyPromise.resolve = resolve;
    readyPromise.reject = reject;
    setTimeout(() => reject(new Error('Index init timeout')), 60_000);
  });
}

/**
 * 通知 Worker 增量更新
 */
export async function notifyIndexUpdate(documentId: string): Promise<void> {
  const w = ensureWorker();
  w.postMessage({ type: 'UPSERT_DOCUMENT', payload: { documentId } });
}

/**
 * 通知 Worker 删除
 */
export async function notifyIndexRemove(documentId: string): Promise<void> {
  const w = ensureWorker();
  w.postMessage({ type: 'REMOVE_DOCUMENT', payload: { documentId } });
}

/**
 * 搜索
 */
export async function search(query: string, limit = 20): Promise<SearchResult[]> {
  if (!indexReady) {
    await initIndex();
  }
  return new Promise((resolve) => {
    const w = ensureWorker();
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'SEARCH_RESULT' && e.data?.queryId === queryId) {
        w.removeEventListener('message', handler);
        resolve(e.data.results as SearchResult[]);
      }
    };
    w.addEventListener('message', handler);
    const queryId = Math.random().toString(36).slice(2);
    w.postMessage({ type: 'SEARCH', payload: { query, limit, queryId } });
  });
}

/**
 * 直接查询 IndexedDB 的降级实现
 * 参考 doc/tasks/search.md 章节 6
 */
export async function searchFallback(
  query: string,
  limit = 20
): Promise<SearchResult[]> {
  const lower = query.toLowerCase();
  const { listDocuments } = await import('@/db/document-repository');
  const { documents } = await listDocuments(1000);
  const matches: SearchResult[] = [];
  for (const doc of documents) {
    if (doc.title.toLowerCase().includes(lower)) {
      matches.push({
        id: doc.id,
        title: doc.title,
        url: doc.url,
        createdAt: doc.createdAt,
        score: 2,
        snippet: doc.description || doc.markdownContent.slice(0, 200),
      });
    } else if (doc.markdownContent.toLowerCase().includes(lower)) {
      matches.push({
        id: doc.id,
        title: doc.title,
        url: doc.url,
        createdAt: doc.createdAt,
        score: 1,
        snippet: extractSnippet(doc.markdownContent, query),
      });
    }
    if (matches.length >= limit) break;
  }
  return matches;
}

function extractSnippet(text: string, query: string, contextLen = 100): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 200);
  const start = Math.max(0, idx - contextLen);
  const end = Math.min(text.length, idx + query.length + contextLen);
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
}

/**
 * 关闭 Worker（测试用）
 */
export function destroyWorker(): void {
  worker?.terminate();
  worker = null;
  indexReady = false;
}

// 防止 getDocument 未使用的警告
void getDocument;
