/**
 * M3 Provider & LLM Client — SSE Parser wrapper
 *
 * Uses `eventsource-parser` to safely parse SSE chunks with
 * multi-byte character (Chinese) truncation protection.
 */

import { createParser, type EventSourceMessage } from 'eventsource-parser';

export type SSEEventHandler = (event: { type: 'event'; data: string; id?: string; event?: string }) => void;

export interface SSEParserController {
  feed(chunk: string): void;
  reset(): void;
}

/**
 * Create an SSE parser that safely handles chunked UTF-8 data.
 *
 * The `eventsource-parser` library already buffers incomplete lines internally,
 * but we add an extra TextDecoder layer to handle multi-byte character truncation
 * at the binary chunk boundary.
 */
export function createSSEParser(onEvent: SSEEventHandler): SSEParserController {
  const parser = createParser({
    onEvent: (event: EventSourceMessage) => {
      onEvent({
        type: 'event',
        data: event.data,
        id: event.id,
        event: event.event,
      });
    },
  });

  return {
    feed(chunk: string) {
      parser.feed(chunk);
    },
    reset() {
      parser.reset();
    },
  };
}

/**
 * Decode a Uint8Array chunk into a string, handling multi-byte truncation.
 *
 * When `stream: true`, TextDecoder keeps state across calls so that
 * incomplete multi-byte sequences at the end of one chunk are held
 * and combined with the next chunk.
 */
export function createStreamingDecoder(): {
  decode(chunk: Uint8Array): string;
} {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return {
    decode(chunk: Uint8Array): string {
      return decoder.decode(chunk, { stream: true });
    },
  };
}
