import { describe, it, expect } from 'vitest';
import { readSSEStream } from '@/utils/llm/sse';

function mockResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return { body: stream } as unknown as Response;
}

async function collect(stream: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = [];
  for await (const data of stream) {
    results.push(data);
  }
  return results;
}

describe('readSSEStream', () => {
  it('parses normal SSE chunks', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
    ];
    const response = mockResponse(chunks);
    const results = await collect(readSSEStream(response));
    expect(results).toEqual([
      '{"choices":[{"delta":{"content":"Hello"}}]}',
      '{"choices":[{"delta":{"content":" World"}}]}',
    ]);
  });

  it('stops on [DONE] marker', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: [DONE]\n\n',
      'data: {"choices":[{"delta":{"content":"Ignored"}}]}\n\n',
    ];
    const response = mockResponse(chunks);
    const results = await collect(readSSEStream(response));
    expect(results).toEqual([
      '{"choices":[{"delta":{"content":"Hello"}}]}',
    ]);
  });

  it('handles partial lines across chunks', async () => {
    const chunks = [
      'data: {"cho',
      'ices":[{"delta":{"content":"Hello"}}]}\n\n',
    ];
    const response = mockResponse(chunks);
    const results = await collect(readSSEStream(response));
    expect(results).toEqual([
      '{"choices":[{"delta":{"content":"Hello"}}]}',
    ]);
  });

  it('handles empty stream', async () => {
    const response = mockResponse([]);
    const results = await collect(readSSEStream(response));
    expect(results).toEqual([]);
  });

  it('processes buffer with trailing data', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"end"}}]}\n',
      // No final \n\n — just the last line without double newline
    ];
    const response = mockResponse(chunks);
    const results = await collect(readSSEStream(response));
    expect(results).toEqual([
      '{"choices":[{"delta":{"content":"end"}}]}',
    ]);
  });
});
