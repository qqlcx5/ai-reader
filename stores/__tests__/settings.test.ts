import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { browser } from 'wxt/browser';

// We need to import the store after pinia is set up
let useSettingsStore: typeof import('@/stores/settings').useSettingsStore;

describe('useSettingsStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    // Dynamically import to ensure fresh module
    const mod = await import('@/stores/settings');
    useSettingsStore = mod.useSettingsStore;
  });

  it('load() populates providers from storage', async () => {
    const savedData = {
      'ai-reader-settings': {
        providers: {
          openai: { apiKey: 'sk-test', baseUrl: 'https://api.openai.com', model: 'gpt-4o' },
        },
        enabledProviders: ['openai'],
      },
    };
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(savedData);

    const store = useSettingsStore();
    await store.load();

    expect(store.providers.openai.apiKey).toBe('sk-test');
    expect(store.providers.openai.model).toBe('gpt-4o');
    expect(store.ready).toBe(true);
  });

  it('updateProvider merges config', async () => {
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    const store = useSettingsStore();
    await store.load();

    const originalBaseUrl = store.providers.openai.baseUrl;
    store.updateProvider('openai', { apiKey: 'new-key' });
    expect(store.providers.openai.apiKey).toBe('new-key');
    expect(store.providers.openai.baseUrl).toBe(originalBaseUrl);
  });

  it('toggleProvider adds provider when not enabled', async () => {
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    const store = useSettingsStore();
    await store.load();

    const initialLength = store.enabledProviders.length;
    store.toggleProvider('anthropic');
    expect(store.enabledProviders).toContain('anthropic');
    expect(store.enabledProviders.length).toBe(initialLength + 1);
  });

  it('toggleProvider removes provider when already enabled', async () => {
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    const store = useSettingsStore();
    await store.load();

    // openai is enabled by default
    expect(store.enabledProviders).toContain('openai');
    store.toggleProvider('openai');
    expect(store.enabledProviders).not.toContain('openai');
  });
});
