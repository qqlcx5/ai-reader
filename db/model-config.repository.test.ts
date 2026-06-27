// ============================================================
// Model Config Repository Tests (Vitest + jsdom)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { modelConfigRepo } from './model-config.repository';
import type { StoredProviderConfig } from '../shared/domain';

const DERIVE_PASS = 'test-derivation-password-for-unit-tests';

describe('ModelConfigRepository', () => {
  beforeEach(async () => {
    await chrome.storage.sync.remove('superbrain_model_config');
    await chrome.storage.local.remove([
      'superbrain_api_key_encrypted',
      'superbrain_api_key_salt',
      'superbrain_connection_status',
    ]);
  });

  // ---- Provider Config (sync storage) ----

  describe('saveConfig / getConfig', () => {
    it('saves and retrieves provider config', async () => {
      const config: StoredProviderConfig = {
        providerId: 'deepseek',
        providerName: 'DeepSeek',
        modelName: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com/v1',
        isActive: true,
        updatedAt: new Date().toISOString(),
      };

      await modelConfigRepo.saveConfig(config);
      const retrieved = await modelConfigRepo.getConfig();

      expect(retrieved).toBeDefined();
      expect(retrieved!.providerId).toBe('deepseek');
      expect(retrieved!.providerName).toBe('DeepSeek');
      expect(retrieved!.modelName).toBe('deepseek-chat');
      expect(retrieved!.baseUrl).toBe('https://api.deepseek.com/v1');
      expect(retrieved!.isActive).toBe(true);
      expect(retrieved!.updatedAt).toBeTruthy();
    });

    it('returns null when no config is saved', async () => {
      const config = await modelConfigRepo.getConfig();
      expect(config).toBeNull();
    });

    it('overwrites existing config on save', async () => {
      await modelConfigRepo.saveConfig({
        providerId: 'deepseek',
        providerName: 'DeepSeek',
        modelName: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com/v1',
        isActive: true,
        updatedAt: new Date().toISOString(),
      });

      await modelConfigRepo.saveConfig({
        providerId: 'claude',
        providerName: 'Claude',
        modelName: 'claude-3-5-sonnet',
        baseUrl: 'https://api.anthropic.com/v1',
        isActive: true,
        updatedAt: new Date().toISOString(),
      });

      const retrieved = await modelConfigRepo.getConfig();
      expect(retrieved!.providerId).toBe('claude');
    });
  });

  describe('clearConfig', () => {
    it('clears saved config', async () => {
      await modelConfigRepo.saveConfig({
        providerId: 'deepseek',
        providerName: 'DeepSeek',
        modelName: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com/v1',
        isActive: true,
        updatedAt: new Date().toISOString(),
      });

      await modelConfigRepo.clearConfig();
      const config = await modelConfigRepo.getConfig();
      expect(config).toBeNull();
    });

    it('is safe to call when no config exists', async () => {
      await expect(modelConfigRepo.clearConfig()).resolves.toBeUndefined();
    });
  });

  // ---- API Key (local storage, encrypted) ----

  describe('saveApiKey / loadApiKey', () => {
    it('encrypts, stores, and retrieves API key', async () => {
      const apiKey = 'sk-test-key-1234567890';

      await modelConfigRepo.saveApiKey(apiKey, DERIVE_PASS);
      const loaded = await modelConfigRepo.loadApiKey(DERIVE_PASS);

      expect(loaded).toBe(apiKey);
    });

    it('stores encrypted data (not plaintext)', async () => {
      const apiKey = 'sk-secret-key';

      await modelConfigRepo.saveApiKey(apiKey, DERIVE_PASS);

      // Check raw storage doesn't contain plaintext
      const raw = await chrome.storage.local.get([
        'superbrain_api_key_encrypted',
        'superbrain_api_key_salt',
      ]);
      expect(raw.superbrain_api_key_encrypted).toBeTruthy();
      expect(raw.superbrain_api_key_encrypted).not.toContain(apiKey);
      expect(raw.superbrain_api_key_encrypted).not.toContain('sk-secret-key');

      // Salt should be stored as array
      expect(raw.superbrain_api_key_salt).toBeInstanceOf(Array);
      expect(raw.superbrain_api_key_salt.length).toBe(16);
    });

    it('returns null when no API key stored', async () => {
      const result = await modelConfigRepo.loadApiKey(DERIVE_PASS);
      expect(result).toBeNull();
    });

    it('fails to decrypt with wrong password', async () => {
      await modelConfigRepo.saveApiKey('sk-secret', DERIVE_PASS);

      // Should throw when using a different password
      await expect(
        modelConfigRepo.loadApiKey('wrong-password'),
      ).rejects.toThrow();
    });

    it('handles various API key formats', async () => {
      const testKeys = [
        'sk-abc123',
        'sk-ant-api03-xxx-yyy',
        '',
        'key-with-dashes-and-underscores_123',
        'a'.repeat(500),
      ];

      for (const key of testKeys) {
        await modelConfigRepo.saveApiKey(key, DERIVE_PASS);
        const loaded = await modelConfigRepo.loadApiKey(DERIVE_PASS);
        expect(loaded).toBe(key);
      }
    });
  });

  describe('hasApiKey', () => {
    it('returns true when key is stored', async () => {
      expect(await modelConfigRepo.hasApiKey()).toBe(false);

      await modelConfigRepo.saveApiKey('sk-test', DERIVE_PASS);

      expect(await modelConfigRepo.hasApiKey()).toBe(true);
    });

    it('returns false after deletion', async () => {
      await modelConfigRepo.saveApiKey('sk-test', DERIVE_PASS);
      expect(await modelConfigRepo.hasApiKey()).toBe(true);

      await modelConfigRepo.deleteApiKey();
      expect(await modelConfigRepo.hasApiKey()).toBe(false);
    });
  });

  describe('deleteApiKey', () => {
    it('removes both ciphertext and salt', async () => {
      await modelConfigRepo.saveApiKey('sk-test', DERIVE_PASS);
      await modelConfigRepo.deleteApiKey();

      const raw = await chrome.storage.local.get([
        'superbrain_api_key_encrypted',
        'superbrain_api_key_salt',
      ]);
      expect(raw.superbrain_api_key_encrypted).toBeUndefined();
      expect(raw.superbrain_api_key_salt).toBeUndefined();
    });

    it('is safe to call when no key exists', async () => {
      await expect(modelConfigRepo.deleteApiKey()).resolves.toBeUndefined();
    });
  });

  // ---- Connection Status ----

  describe('saveConnectionStatus / getConnectionStatus', () => {
    it('saves and retrieves connection status', async () => {
      const status = {
        providerId: 'deepseek',
        providerName: 'DeepSeek',
        modelName: 'deepseek-chat',
        connected: true,
        latencyMs: 120,
        checkedAt: new Date().toISOString(),
      };

      await modelConfigRepo.saveConnectionStatus(status);
      const retrieved = await modelConfigRepo.getConnectionStatus();

      expect(retrieved).toBeDefined();
      expect(retrieved!.providerId).toBe('deepseek');
      expect(retrieved!.connected).toBe(true);
      expect(retrieved!.latencyMs).toBe(120);
    });

    it('returns null when no status saved', async () => {
      const status = await modelConfigRepo.getConnectionStatus();
      expect(status).toBeNull();
    });
  });

  // ---- Full Config Assembly ----

  describe('getFullConfig', () => {
    it('assembles full config from both storage layers', async () => {
      await modelConfigRepo.saveConfig({
        providerId: 'deepseek',
        providerName: 'DeepSeek',
        modelName: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com/v1',
        isActive: true,
        updatedAt: new Date().toISOString(),
      });

      await modelConfigRepo.saveApiKey('sk-full-test-key', DERIVE_PASS);

      const full = await modelConfigRepo.getFullConfig(DERIVE_PASS);

      expect(full).toBeDefined();
      expect(full!.providerId).toBe('deepseek');
      expect(full!.providerName).toBe('DeepSeek');
      expect(full!.modelName).toBe('deepseek-chat');
      expect(full!.baseUrl).toBe('https://api.deepseek.com/v1');
      expect(full!.apiKey).toBe('sk-full-test-key');
    });

    it('returns null when config is missing', async () => {
      await modelConfigRepo.saveApiKey('sk-test', DERIVE_PASS);

      const full = await modelConfigRepo.getFullConfig(DERIVE_PASS);
      expect(full).toBeNull();
    });

    it('returns null when API key is missing', async () => {
      await modelConfigRepo.saveConfig({
        providerId: 'deepseek',
        providerName: 'DeepSeek',
        modelName: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com/v1',
        isActive: true,
        updatedAt: new Date().toISOString(),
      });

      const full = await modelConfigRepo.getFullConfig(DERIVE_PASS);
      expect(full).toBeNull();
    });
  });
});
