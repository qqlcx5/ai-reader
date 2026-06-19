import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { browser } from 'wxt/browser';

let useContentStore: typeof import('@/stores/content').useContentStore;

describe('useContentStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const mod = await import('@/stores/content');
    useContentStore = mod.useContentStore;
  });

  it('fetchContent sets fields on success', async () => {
    (browser.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      title: 'Test Article',
      url: 'https://example.com',
      content: 'Article content here',
      wordCount: 100,
    });

    const store = useContentStore();
    await store.fetchContent();

    expect(store.title).toBe('Test Article');
    expect(store.url).toBe('https://example.com');
    expect(store.rawContent).toBe('Article content here');
    expect(store.wordCount).toBe(100);
    expect(store.error).toBe('');
    expect(store.loading).toBe(false);
  });

  it('fetchContent sets error on structured error response', async () => {
    (browser.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      title: '',
      url: '',
      content: '',
      wordCount: 0,
      error: 'Tab not found',
    });

    const store = useContentStore();
    await store.fetchContent();

    expect(store.error).toBe('Tab not found');
    expect(store.loading).toBe(false);
  });

  it('fetchContent sets error on thrown exception', async () => {
    (browser.runtime.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network failure')
    );

    const store = useContentStore();
    await store.fetchContent();

    expect(store.error).toBe('Network failure');
    expect(store.loading).toBe(false);
  });

  it('clear resets all fields', async () => {
    (browser.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      title: 'Test',
      url: 'https://example.com',
      content: 'Content',
      wordCount: 50,
    });

    const store = useContentStore();
    await store.fetchContent();
    expect(store.title).toBe('Test');

    store.clear();
    expect(store.title).toBe('');
    expect(store.url).toBe('');
    expect(store.rawContent).toBe('');
    expect(store.wordCount).toBe(0);
    expect(store.error).toBe('');
    expect(store.extractedAt).toBe(0);
  });
});
