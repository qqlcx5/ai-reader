import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { browser } from 'wxt/browser';

let useHistoryStore: typeof import('@/stores/history').useHistoryStore;

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

    await store.addEntry({ title: 'Test', url: 'https://example.com', summary: 'A summary' });

    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].id).toBeTruthy();
    expect(store.entries[0].timestamp).toBeGreaterThan(0);
    expect(store.entries[0].title).toBe('Test');
  });

  it('enforces max 50 entries', async () => {
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    (browser.storage.local.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const store = useHistoryStore();
    await store.load();

    for (let i = 0; i < 55; i++) {
      await store.addEntry({ title: `Title ${i}`, url: `https://example.com/${i}`, summary: `Summary ${i}` });
    }

    expect(store.entries.length).toBeLessThanOrEqual(50);
  });

  it('removeEntry works', async () => {
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    (browser.storage.local.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const store = useHistoryStore();
    await store.load();

    await store.addEntry({ title: 'Test', url: 'https://example.com', summary: 'Summary' });
    const id = store.entries[0].id;

    await store.removeEntry(id);
    expect(store.entries).toHaveLength(0);
  });

  it('clear empties all entries', async () => {
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    (browser.storage.local.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const store = useHistoryStore();
    await store.load();

    await store.addEntry({ title: 'Test 1', url: 'https://example.com', summary: 'Summary 1' });
    await store.addEntry({ title: 'Test 2', url: 'https://example.com', summary: 'Summary 2' });
    expect(store.entries).toHaveLength(2);

    await store.clear();
    expect(store.entries).toHaveLength(0);
  });
});
