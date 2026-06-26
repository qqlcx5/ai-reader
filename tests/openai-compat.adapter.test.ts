import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('openai-compat.adapter - ping', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return success on valid response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{"choices":[{"message":{"content":"pong"}}]}'),
    });

    const { ping } = await import('@/core/models/openai-compat.adapter');
    const result = await ping('https://api.test.com/v1', 'sk-test', 'model-1');

    expect(result.success).toBe(true);
    expect(result.latency).toBeGreaterThanOrEqual(0);
  });

  it('should return error on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    const { ping } = await import('@/core/models/openai-compat.adapter');
    const result = await ping('https://api.test.com/v1', 'bad-key', 'model-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('401');
  });
});

describe('openai-compat.adapter - streamChat', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should call onDelta with content chunks', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    let chunkIndex = 0;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: new ReadableStream({
        pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(encoder.encode(chunks[chunkIndex++]));
          } else {
            controller.close();
          }
        },
      }),
    });

    const { streamChat } = await import('@/core/models/openai-compat.adapter');
    const deltas: string[] = [];
    let doneCalled = false;

    await streamChat(
      'https://api.test.com/v1',
      'sk-test',
      'model-1',
      [{ role: 'user', content: 'Hi' }],
      {
        onDelta: (content) => deltas.push(content),
        onDone: () => { doneCalled = true; },
        onError: () => {},
      },
    );

    expect(deltas).toEqual(['Hello', ' World']);
    expect(doneCalled).toBe(true);
  });

  it('should call onError on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    });

    const { streamChat } = await import('@/core/models/openai-compat.adapter');
    let errorCalled = '';

    await streamChat(
      'https://api.test.com/v1',
      'sk-test',
      'model-1',
      [{ role: 'user', content: 'Hi' }],
      {
        onDelta: () => {},
        onDone: () => {},
        onError: (err) => { errorCalled = err; },
      },
    );

    expect(errorCalled).toContain('429');
  });
});
