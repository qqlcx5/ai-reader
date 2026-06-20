import { getDb } from './db';
import { messageRepo } from './repositories/message.repo';
import type {
  MessageRecord,
  SearchResult,
  SearchWorkerPayload,
  SearchWorkerResponse,
} from './types';

/**
 * M7 — Search service orchestrating title quick filter + Web Worker deep search.
 *
 * 1. Title/preview filter runs on the main thread against the Conversation table.
 * 2. Deep content search runs in a Worker on batches of Messages from Dexie.
 * 3. Debounce 300ms for user input.
 */

const BATCH_SIZE = 500;
const DEBOUNCE_MS = 300;

let worker: Worker | null = null;

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('./search.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[SearchService] Failed to instantiate worker', err);
      worker = null;
    }
  }
  return worker;
}

export interface DeepSearchOptions {
  conversationId?: string;
  batchSize?: number;
  signal?: AbortSignal;
}

export async function* deepSearchStream(
  query: string,
  options: DeepSearchOptions = {},
): AsyncGenerator<SearchResult[], void, unknown> {
  const { conversationId, batchSize = BATCH_SIZE } = options;
  const workerInstance = getWorker();

  if (!workerInstance) {
    // Fallback to main-thread search when Worker is unavailable (e.g. tests).
    for await (const batch of messageRepo.batchIterator(conversationId, batchSize)) {
      if (options.signal?.aborted) return;
      yield searchBatchMainThread(batch, query);
    }
    return;
  }

  let requestId = crypto.randomUUID();
  const pending = new Map<string, (results: SearchResult[]) => void>();

  const messageHandler = (event: MessageEvent<SearchWorkerResponse>) => {
    const { results, requestId: rid } = event.data;
    const resolve = pending.get(rid);
    if (resolve) {
      resolve(results);
      pending.delete(rid);
    }
  };
  workerInstance.addEventListener('message', messageHandler);

  try {
    for await (const batch of messageRepo.batchIterator(conversationId, batchSize)) {
      if (options.signal?.aborted) break;
      const currentId = crypto.randomUUID();
      requestId = currentId;
      const promise = new Promise<SearchResult[]>((resolve) => {
        pending.set(currentId, resolve);
      });
      const payload: SearchWorkerPayload = { query, messages: batch, requestId: currentId };
      workerInstance.postMessage(payload);
      const results = await promise;
      yield results;
    }
  } finally {
    workerInstance.removeEventListener('message', messageHandler);
    for (const resolve of pending.values()) resolve([]);
    pending.clear();
  }
}

export function searchBatchMainThread(messages: MessageRecord[], query: string): SearchResult[] {
  const lower = query.toLowerCase();
  const results: SearchResult[] = [];
  for (const message of messages) {
    const text = [message.content, ...(message.modelResponses || []).map((r) => r.content)]
      .filter(Boolean)
      .join('\n');
    const index = text.toLowerCase().indexOf(lower);
    if (index !== -1) {
      const start = Math.max(0, index - 80);
      const end = Math.min(text.length, index + 80);
      results.push({
        messageId: message.id,
        conversationId: message.conversationId,
        snippet: `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`,
        matchIndex: index,
      });
    }
  }
  return results;
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    return new Promise((resolve) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        resolve(fn(...args));
      }, ms);
    });
  };
}

export { DEBOUNCE_MS, BATCH_SIZE };
export { getDb, messageRepo };
