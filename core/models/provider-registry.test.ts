// ============================================================
// Provider Registry Tests (Vitest + jsdom)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { providerRegistry } from './provider-registry';

describe('ProviderRegistry', () => {
  beforeEach(async () => {
    // Clear sync storage before each test
    await chrome.storage.sync.remove('superbrain_providers');
  });

  describe('load()', () => {
    it('loads builtin providers', async () => {
      const providers = await providerRegistry.load();

      expect(providers.length).toBeGreaterThanOrEqual(4);

      const deepseek = providers.find((p) => p.id === 'deepseek');
      expect(deepseek).toBeDefined();
      expect(deepseek!.name).toBe('DeepSeek');
      expect(deepseek!.isBuiltin).toBe(true);
      expect(deepseek!.models).toContain('deepseek-chat');

      const ollama = providers.find((p) => p.id === 'ollama');
      expect(ollama).toBeDefined();
      expect(ollama!.baseUrl).toBe('http://localhost:11434/v1');
    });

    it('has all 4 default providers', async () => {
      const providers = await providerRegistry.load();
      const ids = providers.map((p) => p.id);
      expect(ids).toContain('deepseek');
      expect(ids).toContain('claude');
      expect(ids).toContain('gpt-4o');
      expect(ids).toContain('ollama');
    });

    it('returns same instance on repeated load', async () => {
      const first = await providerRegistry.load();
      const second = await providerRegistry.load();

      expect(second.length).toBe(first.length);
      expect(second.map((p) => p.id).sort()).toEqual(first.map((p) => p.id).sort());
    });
  });

  describe('getAll()', () => {
    it('returns all providers after load', async () => {
      await providerRegistry.load();
      const all = providerRegistry.getAll();

      expect(all.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('getById()', () => {
    it('finds a provider by id', async () => {
      await providerRegistry.load();
      const provider = providerRegistry.getById('claude');

      expect(provider).toBeDefined();
      expect(provider!.name).toBe('Claude');
    });

    it('returns undefined for unknown id', async () => {
      await providerRegistry.load();
      const provider = providerRegistry.getById('nonexistent');

      expect(provider).toBeUndefined();
    });
  });

  describe('add()', () => {
    it('adds a custom provider', async () => {
      await providerRegistry.load();

      const custom = await providerRegistry.add({
        id: 'groq',
        name: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        models: ['llama-3.3-70b', 'mixtral-8x7b'],
      });

      expect(custom.id).toBe('groq');
      expect(custom.isBuiltin).toBe(false);
      expect(custom.createdAt).toBeTruthy();

      const all = providerRegistry.getAll();
      const found = all.find((p) => p.id === 'groq');
      expect(found).toBeDefined();
    });

    it('persists custom provider across reloads', async () => {
      await providerRegistry.load();
      await providerRegistry.add({
        id: 'fireworks',
        name: 'Fireworks',
        baseUrl: 'https://api.fireworks.ai/inference/v1',
        models: ['accounts/fireworks/models/llama-v3p1-70b'],
      });

      // Reload — simulate new session
      await providerRegistry.load();
      const found = providerRegistry.getById('fireworks');
      expect(found).toBeDefined();
      expect(found!.isBuiltin).toBe(false);
    });

    it('works without explicit load (auto-loads)', async () => {
      // Note: we cleared storage in beforeEach, so this is a fresh state
      const custom = await providerRegistry.add({
        id: 'together',
        name: 'Together AI',
        baseUrl: 'https://api.together.xyz/v1',
        models: ['meta-llama/Llama-3.3-70B'],
      });

      expect(custom.id).toBe('together');
    });
  });

  describe('update()', () => {
    it('updates a builtin provider baseUrl', async () => {
      await providerRegistry.load();

      const updated = await providerRegistry.update('deepseek', {
        baseUrl: 'https://custom-proxy.example.com/v1',
      });

      expect(updated).toBeDefined();
      expect(updated!.baseUrl).toBe('https://custom-proxy.example.com/v1');

      const provider = providerRegistry.getById('deepseek');
      expect(provider!.baseUrl).toBe('https://custom-proxy.example.com/v1');
    });

    it('updates a custom provider', async () => {
      await providerRegistry.load();
      await providerRegistry.add({
        id: 'test-prov',
        name: 'Test Provider',
        baseUrl: 'https://old.example.com',
        models: ['old-model'],
      });

      const updated = await providerRegistry.update('test-prov', {
        baseUrl: 'https://new.example.com',
        models: ['new-model-1', 'new-model-2'],
      });

      expect(updated).toBeDefined();
      expect(updated!.baseUrl).toBe('https://new.example.com');
      expect(updated!.models).toEqual(['new-model-1', 'new-model-2']);
    });

    it('returns undefined for unknown provider', async () => {
      await providerRegistry.load();
      const result = await providerRegistry.update('nonexistent', {
        baseUrl: 'https://example.com',
      });
      expect(result).toBeUndefined();
    });
  });

  describe('remove()', () => {
    it('removes a custom provider', async () => {
      await providerRegistry.load();
      await providerRegistry.add({
        id: 'to-remove',
        name: 'Remove Me',
        baseUrl: 'https://example.com',
        models: ['test'],
      });

      const result = await providerRegistry.remove('to-remove');
      expect(result).toBe(true);

      const found = providerRegistry.getById('to-remove');
      expect(found).toBeUndefined();
    });

    it('cannot remove a builtin provider', async () => {
      await providerRegistry.load();

      const result = await providerRegistry.remove('deepseek');
      expect(result).toBe(false);

      const found = providerRegistry.getById('deepseek');
      expect(found).toBeDefined();
    });

    it('returns false for unknown provider', async () => {
      await providerRegistry.load();
      const result = await providerRegistry.remove('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('isBuiltin()', () => {
    it('returns true for builtin providers', async () => {
      await providerRegistry.load();
      expect(providerRegistry.isBuiltin('deepseek')).toBe(true);
      expect(providerRegistry.isBuiltin('claude')).toBe(true);
    });

    it('returns false for custom providers', async () => {
      await providerRegistry.load();
      await providerRegistry.add({
        id: 'custom-1',
        name: 'Custom',
        baseUrl: 'https://example.com',
        models: ['test'],
      });
      expect(providerRegistry.isBuiltin('custom-1')).toBe(false);
    });
  });

  describe('buildConfig()', () => {
    it('builds a ModelConfig from provider + model', async () => {
      await providerRegistry.load();

      const config = providerRegistry.buildConfig('deepseek', 'deepseek-chat');
      expect(config).toBeDefined();
      expect(config!.providerId).toBe('deepseek');
      expect(config!.providerName).toBe('DeepSeek');
      expect(config!.modelName).toBe('deepseek-chat');
      expect(config!.baseUrl).toBe('https://api.deepseek.com/v1');
    });

    it('returns undefined for unknown provider', async () => {
      await providerRegistry.load();
      const config = providerRegistry.buildConfig('nonexistent', 'test');
      expect(config).toBeUndefined();
    });
  });
});
