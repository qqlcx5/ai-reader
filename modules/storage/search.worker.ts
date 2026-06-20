/**
 * M7 — Web Worker for deep message content search.
 *
 * Receives batches of MessageRecord objects from the main thread, extracts
 * searchable text (user content + all model responses), and returns matching
 * snippets.
 *
 * This file is loaded as a module Worker via `new Worker(new URL(...), { type: 'module' })`.
 */
import type { MessageRecord, ModelResponse, SearchResult, SearchWorkerPayload } from './types';

function extractSearchableText(message: MessageRecord): string {
  const parts: string[] = [];
  if (message.content) parts.push(message.content);
  for (const response of message.modelResponses || []) {
    if (response.content) parts.push(response.content);
  }
  return parts.join('\n');
}

function extractSnippet(text: string, index: number, radius = 80): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
}

function searchBatch(messages: MessageRecord[], query: string): SearchResult[] {
  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];
  for (const message of messages) {
    const text = extractSearchableText(message);
    const index = text.toLowerCase().indexOf(lowerQuery);
    if (index !== -1) {
      results.push({
        messageId: message.id,
        conversationId: message.conversationId,
        snippet: extractSnippet(text, index),
        matchIndex: index,
      });
    }
  }
  return results;
}

self.onmessage = (event: MessageEvent<SearchWorkerPayload>) => {
  const { query, messages, requestId } = event.data;
  const results = searchBatch(messages, query);
  self.postMessage({ results, requestId });
};

export {};
