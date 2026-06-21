/**
 * Search Service — Web Worker full-text search orchestration
 *
 * Offloads regex/text matching from the main thread to a Web Worker
 * to avoid blocking the UI when searching through thousands of long
 * message records.
 *
 * Based on design-07-storage-data.md §6.
 */

import type { SearchResult, MessageRecord, SearchWorkerPayload, SearchWorkerResponse } from './types';

// ─── Main-Thread API ─────────────────────────────────────────────────

let worker: Worker | null = null;
const pendingRequests = new Map<string, {
  resolve: (results: SearchResult[]) => void;
  reject: (reason: Error) => void;
}>();

function getWorker(): Worker {
  if (!worker) {
    // Inline worker creation using a Blob URL.
    // In production, this should reference the built worker bundle.
    const workerCode = `
      ${searchWorkerFunction.toString()}
      self.onmessage = onMessage;
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (event: MessageEvent<SearchWorkerResponse>) => {
      const { results, requestId } = event.data;
      const pending = pendingRequests.get(requestId);
      if (pending) {
        pendingRequests.delete(requestId);
        pending.resolve(results);
      }
    };

    worker.onerror = () => {
      // On error, reject all pending requests
      for (const [id, pending] of pendingRequests) {
        pending.reject(new Error('Search worker crashed'));
        pendingRequests.delete(id);
      }
    };
  }
  return worker;
}

/**
 * Search messages in batches via Web Worker.
 *
 * The caller should:
 * 1. Use messageRepo.batchIterator() to feed batches
 * 2. Accumulate results from each batch
 */
export function searchMessagesInWorker(
  query: string,
  messages: MessageRecord[],
): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    pendingRequests.set(requestId, { resolve, reject });

    const payload: SearchWorkerPayload = {
      query: query.trim(),
      messages,
      requestId,
    };

    try {
      getWorker().postMessage(payload);
    } catch (err) {
      pendingRequests.delete(requestId);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Full-text search with batch iteration support.
 *
 * Feeds message batches to the worker sequentially, collecting results.
 * Uses async generator to avoid loading all messages at once.
 */
export async function searchAllMessages(
  query: string,
  batchIterator: AsyncGenerator<MessageRecord[], void, unknown>,
  onProgress?: (resultsSoFar: number) => void,
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  const trimmedQuery = query.trim();

  if (!trimmedQuery || trimmedQuery.length < 2) {
    return [];
  }

  for await (const batch of batchIterator) {
    const results = await searchMessagesInWorker(trimmedQuery, batch);
    allResults.push(...results);
    onProgress?.(allResults.length);
  }

  return allResults;
}

/**
 * Terminate the worker instance (e.g., on extension suspend/shutdown).
 */
export function terminateSearchWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    pendingRequests.clear();
  }
}

// ─── Worker Code (inlined as function for Blob URL) ─────────────────

/* eslint-disable no-restricted-globals */
function searchWorkerFunction() {
  interface InternalPayload {
    query: string;
    messages: MessageRecord[];
    requestId: string;
  }

  interface InternalResult {
    messageId: string;
    conversationId: string;
    snippet: string;
    matchIndex: number;
  }

  function extractSearchableText(msg: MessageRecord): string {
    const parts: string[] = [];
    if (msg.content) parts.push(msg.content);
    for (const resp of msg.modelResponses) {
      if (resp.content) parts.push(resp.content);
    }
    return parts.join(' ');
  }

  function extractSnippet(text: string, matchIndex: number, width: number): string {
    const start = Math.max(0, matchIndex - Math.floor(width / 3));
    const end = Math.min(text.length, matchIndex + Math.floor((2 * width) / 3));
    let snippet = text.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    return snippet;
  }

  function onMessage(event: MessageEvent<InternalPayload>) {
    const { query, messages, requestId } = event.data;
    const lowerQuery = query.toLowerCase();
    const results: InternalResult[] = [];

    for (const msg of messages) {
      const text = extractSearchableText(msg);
      const index = text.toLowerCase().indexOf(lowerQuery);
      if (index !== -1) {
        results.push({
          messageId: msg.id,
          conversationId: msg.conversationId,
          snippet: extractSnippet(text, index, 120),
          matchIndex: index,
        });
      }
    }

    self.postMessage({ results, requestId });
  }
}
/* eslint-enable no-restricted-globals */

export { searchWorkerFunction };
