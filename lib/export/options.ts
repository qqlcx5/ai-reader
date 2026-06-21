/**
 * M6 — Adapter between the M7 `ExportConfig` (flat fields) and the
 * M6 `WebDAVOptions` / `ObsidianOptions` runtime structures.
 */
import type { ExportConfig } from '@/modules/storage/types';
import { ExportConfigError, type WebDAVOptions, type ObsidianOptions } from './types';

export function toWebDAVOptions(config: ExportConfig): WebDAVOptions {
  if (!config.webDAVUrl) {
    throw new ExportConfigError('webdav', 'WebDAV URL 未配置');
  }
  return {
    url: config.webDAVUrl,
    username: config.webDAVUsername ?? '',
    password: config.webDAVPassword ?? '',
    backupPath: config.webDAVBackupPath ?? '/ai-reader',
  };
}

export function toObsidianOptions(config: ExportConfig): ObsidianOptions {
  if (!config.obsidianVault) {
    throw new ExportConfigError('obsidian', 'Obsidian vault 未配置');
  }
  return {
    vault: config.obsidianVault,
    folder: config.obsidianFolder,
  };
}

export function hasWebDAVConfig(config: ExportConfig): boolean {
  return Boolean(config.webDAVUrl && config.webDAVUsername);
}

export function hasObsidianConfig(config: ExportConfig): boolean {
  return Boolean(config.obsidianVault);
}
