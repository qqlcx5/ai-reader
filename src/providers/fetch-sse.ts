/**
 * fetchSSE — Centralized SSE streaming fetch utility
 *
 * Handles Server-Sent Events streaming with proper multi-byte character
 * (e.g. Chinese/UTF-8) truncation protection via TextDecoder streaming mode
 * and eventsource-parser for line-buffered protocol parsing.
 *
 * Based on nextai-translator's fetchSSE() implementation.
 */

import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { ProviderError, ABORTED } from './types';

// ─── Types ────────────────────────────────────────────────────────────

export interface FetchSSEOptions extends Omit<RequestInit, 'signal'> {
  /** Called for each parsed SSE event (data line) */
  onMessage: (data: string) => Promise<void>;
  /** Called on fetch or parse errors */
  onError: (error: Error | string) => void;
  /** Optional status code callback */
  onStatusCode?: (statusCode: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Custom fetch function (allows injection for testing) */
  fetcher?: typeof fetch;
}

// ─── Implementation ───────────────────────────────────────────────────

export async function fetchSSE(
  input: string,
  options: FetchSSEOptions,
): Promise<void> {
  const {
    onMessage,
    onError,
    onStatusCode,
    signal,
    fetcher = fetch,
    ...fetchOptions
  } = options;

  // Check if already aborted before making request
  if (signal?.aborted) {
    onError(new ProviderError(ABORTED, 'Request was aborted before fetch'));
    return;
  }

  let finished = false;

  const sseParser = createParser({
    onEvent: (event: EventSourceMessage) => {
      if (finished) return;
      if (event.data) {
        onMessage(event.data).catch((err) => {
          if (!finished) {
            finished = true;
            onError(err instanceof Error ? err : String(err));
          }
        });
      }
    },
  });

  try {
    const response = await fetcher(input, {
      ...fetchOptions,
      signal,
    });

    onStatusCode?.(response.status);

    if (!response.ok) {
      let errorBody: string;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = `HTTP ${response.status}`;
      }
      onError(errorBody);
      return;
    }

    if (!response.body) {
      onError('Response body is null');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: false });

    try {
      while (true) {
        if (signal?.aborted) {
          finished = true;
          onError(new ProviderError(ABORTED, 'Request was aborted'));
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        // stream: true keeps TextDecoder state across calls, preventing
        // multi-byte character truncation at chunk boundaries
        const text = decoder.decode(value, { stream: true });
        sseParser.feed(text);
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      onError(new ProviderError(ABORTED, 'Request was aborted'));
      return;
    }
    onError(error instanceof Error ? error : String(error));
  }
}
