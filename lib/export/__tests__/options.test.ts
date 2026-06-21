import { describe, expect, it } from 'vitest';
import {
  toWebDAVOptions,
  toObsidianOptions,
  hasWebDAVConfig,
  hasObsidianConfig,
  ExportConfigError,
} from '@/lib/export';
import type { ExportConfig } from '@/modules/storage/types';

const baseConfig: ExportConfig = {
  format: 'markdown',
  includeApiKeys: false,
  autoBackupEnabled: false,
};

describe('export options adapter', () => {
  describe('toWebDAVOptions', () => {
    it('maps M7 fields to WebDAVOptions', () => {
      const result = toWebDAVOptions({
        ...baseConfig,
        webDAVUrl: 'https://dav.example.com',
        webDAVUsername: 'alice',
        webDAVPassword: 'secret',
        webDAVBackupPath: '/ai-reader',
      });
      expect(result).toEqual({
        url: 'https://dav.example.com',
        username: 'alice',
        password: 'secret',
        backupPath: '/ai-reader',
      });
    });

    it('defaults backupPath to /ai-reader', () => {
      const result = toWebDAVOptions({
        ...baseConfig,
        webDAVUrl: 'https://dav',
        webDAVUsername: 'u',
      });
      expect(result.backupPath).toBe('/ai-reader');
    });

    it('throws ExportConfigError when URL is missing', () => {
      expect(() => toWebDAVOptions(baseConfig)).toThrow(ExportConfigError);
    });
  });

  describe('toObsidianOptions', () => {
    it('maps M7 fields to ObsidianOptions', () => {
      const result = toObsidianOptions({
        ...baseConfig,
        obsidianVault: 'Personal',
        obsidianFolder: 'inbox',
      });
      expect(result).toEqual({ vault: 'Personal', folder: 'inbox' });
    });

    it('throws ExportConfigError when vault is missing', () => {
      expect(() => toObsidianOptions(baseConfig)).toThrow(ExportConfigError);
    });
  });

  describe('hasWebDAVConfig', () => {
    it('returns true when both URL and username are set', () => {
      expect(
        hasWebDAVConfig({ ...baseConfig, webDAVUrl: 'https://d', webDAVUsername: 'u' }),
      ).toBe(true);
    });
    it('returns false when only URL is set', () => {
      expect(hasWebDAVConfig({ ...baseConfig, webDAVUrl: 'https://d' })).toBe(false);
    });
    it('returns false on empty config', () => {
      expect(hasWebDAVConfig(baseConfig)).toBe(false);
    });
  });

  describe('hasObsidianConfig', () => {
    it('returns true when vault is set', () => {
      expect(hasObsidianConfig({ ...baseConfig, obsidianVault: 'V' })).toBe(true);
    });
    it('returns false on empty config', () => {
      expect(hasObsidianConfig(baseConfig)).toBe(false);
    });
  });
});
