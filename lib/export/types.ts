/**
 * M6 — Export & Sync types.
 *
 * The on-disk representation is the M7 `ExportConfig` (flat fields).
 * This module reuses those field names and exposes richer runtime
 * helpers (build / parse / validate) on top.
 */
import type { ExportConfig } from '@/modules/storage/types';

export type ExportFormat = ExportConfig['format'];
export type ExportTarget = 'obsidian' | 'webdav' | 'zip' | 'json';

export interface ExportTask {
  id: string;
  type: ExportTarget;
  status: 'pending' | 'running' | 'done' | 'error';
  createdAt: number;
  completedAt?: number;
  error?: { code: string; message: string };
  /** Human-readable label for UI. */
  label?: string;
}

export interface ObsidianOptions {
  vault: string;
  folder?: string;
}

export interface WebDAVOptions {
  url: string;
  username: string;
  password: string;
  /** Path prefix (e.g. `/ai-reader`). */
  backupPath: string;
}

/**
 * Thrown when the user has not configured a target.
 * UI converts this to a "please fill in Options" hint.
 */
export class ExportConfigError extends Error {
  readonly code = 'EXPORT_CONFIG_MISSING';
  constructor(target: ExportTarget, message: string) {
    super(`[${target}] ${message}`);
    this.name = 'ExportConfigError';
  }
}

/**
 * Thrown when the URI / payload exceeds the browser URI length cap.
 */
export class PayloadTooLargeError extends Error {
  readonly code = 'PAYLOAD_TOO_LARGE';
  constructor(public readonly byteLength: number, public readonly limit: number) {
    super(`payload length ${byteLength} exceeds ${limit}`);
    this.name = 'PayloadTooLargeError';
  }
}

/**
 * Thrown when WebDAV authentication fails (HTTP 401/403).
 */
export class WebDAVAuthError extends Error {
  readonly code = 'WEBDAV_AUTH_FAILED';
  constructor(public readonly status: number) {
    super(`WebDAV authentication failed (status=${status})`);
    this.name = 'WebDAVAuthError';
  }
}

/** Conservative browser-side URI length cap (Chrome ~2MB, Safari ~80KB). */
export const OBSIDIAN_URI_SAFE_BYTES = 32_000;
