import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn((msg: any) => {
    // Simulate INIT_INDEX response
    if (msg.type === 'INIT_INDEX') {
      setTimeout(() => {
        this.onmessage?.(new MessageEvent('message', {
          data: { type: 'INDEX_READY' },
        }));
      }, 0);
    }
    // Simulate SEARCH response
    if (msg.type === 'SEARCH') {
      setTimeout(() => {
        this.onmessage?.(new MessageEvent('message', {
          data: {
            type: 'SEARCH_RESULT',
            requestId: msg.requestId,
            results: [
              { id: '1', title: 'Test Doc', url: 'https://test.com', score: 1.5, createdAt: Date.now() },
            ],
          },
        }));
      }, 0);
    }
  });
  terminate = vi.fn();
}

describe('SearchClient', () => {
  it('should handle INDEX_READY event', async () => {
    const { SearchClient } = await import('@/core/search/search.client');

    // Mock Worker constructor
    const originalWorker = globalThis.Worker;
    globalThis.Worker = MockWorker as any;

    const client = new SearchClient();
    client.init();

    await new Promise<void>((resolve) => {
      client.onReady(() => {
        expect(client.isReady()).toBe(true);
        resolve();
      });
    });

    client.destroy();
    globalThis.Worker = originalWorker;
  });

  it('should return search results', async () => {
    const { SearchClient } = await import('@/core/search/search.client');

    const originalWorker = globalThis.Worker;
    globalThis.Worker = MockWorker as any;

    const client = new SearchClient();
    client.init();

    // Wait for ready
    await new Promise<void>((resolve) => client.onReady(resolve));

    const results = await client.search('test');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Test Doc');

    client.destroy();
    globalThis.Worker = originalWorker;
  });
});
