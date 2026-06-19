import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

let useConversationsStore: typeof import('@/stores/conversations').useConversationsStore;

describe('useConversationsStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const mod = await import('@/stores/conversations');
    useConversationsStore = mod.useConversationsStore;
  });

  it('addMessage adds to provider history', () => {
    const store = useConversationsStore();
    store.addMessage('openai', { role: 'user', content: 'Hello' });
    expect(store.getHistory('openai')).toHaveLength(1);
    expect(store.getHistory('openai')[0].content).toBe('Hello');
  });

  it('getHistory returns correct messages per provider', () => {
    const store = useConversationsStore();
    store.addMessage('openai', { role: 'user', content: 'Hello OpenAI' });
    store.addMessage('anthropic', { role: 'user', content: 'Hello Anthropic' });

    expect(store.getHistory('openai')).toHaveLength(1);
    expect(store.getHistory('openai')[0].content).toBe('Hello OpenAI');
    expect(store.getHistory('anthropic')).toHaveLength(1);
    expect(store.getHistory('anthropic')[0].content).toBe('Hello Anthropic');
  });

  it('clearHistory clears one provider', () => {
    const store = useConversationsStore();
    store.addMessage('openai', { role: 'user', content: 'Hello' });
    store.addMessage('anthropic', { role: 'user', content: 'Hello' });

    store.clearHistory('openai');
    expect(store.getHistory('openai')).toHaveLength(0);
    expect(store.getHistory('anthropic')).toHaveLength(1);
  });

  it('clearAll clears all providers', () => {
    const store = useConversationsStore();
    store.addMessage('openai', { role: 'user', content: 'Hello' });
    store.addMessage('anthropic', { role: 'user', content: 'Hello' });

    store.clearAll();
    expect(store.getHistory('openai')).toHaveLength(0);
    expect(store.getHistory('anthropic')).toHaveLength(0);
  });

  it('buildPromptWithContext includes article, history, and message', () => {
    const store = useConversationsStore();
    store.addMessage('openai', { role: 'user', content: 'What is this?' });
    store.addMessage('openai', { role: 'assistant', content: 'It is an article.' });

    const prompt = store.buildPromptWithContext(
      'openai',
      'Article body here.',
      'Tell me more',
    );

    expect(prompt).toContain('Article body here.');
    expect(prompt).toContain('What is this?');
    expect(prompt).toContain('It is an article.');
    expect(prompt).toContain('Tell me more');
  });
});
