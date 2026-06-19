import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { browser } from 'wxt/browser';

let useHistoryStore: typeof import('@/stores/history').useHistoryStore;

function makeResponses(text = 'A summary', count = 1) {
  return Array.from({ length: count }, () => ({
    providerId: 'openai',
    modelId: 'gpt-4o-mini',
    text,
    status: 'done' as const,
    inputTokens: 10,
    outputTokens: 20,
    estimatedCost: 0.001,
    elapsedMs: 1000,
  }));
}

describe('useHistoryStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const mod = await import('@/stores/history');
    useHistoryStore = mod.useHistoryStore;
  });

  it('addEntry generates id and timestamp', async () => {
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    (browser.storage.local.set as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    const store = useHistoryStore();
    await store.load();

    await store.addEntry({
      title: 'Test',
      url: 'https://example.com',
      prompt: 'summarize this',
      wordCount: 100,
      responses: makeResponses(),
    });

    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].id).toBeTruthy();
    expect(store.entries[0].timestamp).toBeGreaterThan(0);
    expect(store.entries[0].title).toBe('Test');
    expect(store.entries[0].summary).toBe('A summary');
  });

  it('enforces max 50 entries', async () => {
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    (browser.storage.local.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const store = useHistoryStore();
    await store.load();

    for (let i = 0; i < 55; i++) {
      await store.addEntry({
        title: `Title ${i}`,
        url: `https://example.com/${i}`,
        prompt: 'p',
        wordCount: 0,
        responses: makeResponses(`Summary ${i}`),
      });
    }

    expect(store.entries.length).toBeLessThanOrEqual(50);
  });

  it('removeEntry works', async () => {
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    (browser.storage.local.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const store = useHistoryStore();
    await store.load();

    await store.addEntry({
      title: 'Test', url: 'https://example.com', prompt: 'p', wordCount: 0,
      responses: makeResponses(),
    });
    const id = store.entries[0].id;

    await store.removeEntry(id);
    expect(store.entries).toHaveLength(0);
  });

  it('clear empties all entries', async () => {
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    (browser.storage.local.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const store = useHistoryStore();
    await store.load();

    await store.addEntry({
      title: 'Test 1', url: 'https://example.com', prompt: 'p', wordCount: 0,
      responses: makeResponses('Summary 1'),
    });
    await store.addEntry({
      title: 'Test 2', url: 'https://example.com', prompt: 'p', wordCount: 0,
      responses: makeResponses('Summary 2'),
    });
    expect(store.entries).toHaveLength(2);

    await store.clear();
    expect(store.entries).toHaveLength(0);
  });
});
