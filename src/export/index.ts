/**
 * Export Module — Unified Export
 *
 * Provides:
 * - Obsidian URI generation with clipboard fallback
 * - WebDAV Markdown + backup upload
 * - Zip export with Web Worker packaging
 * - Auto-backup scheduling via chrome.alarms
 *
 * Based on design-06-export-sync.md and obsidian-clipper's export patterns.
 */

// ─── Obsidian ─────────────────────────────────────────────────────────

export {
  buildObsidianUri,
  exportToObsidian,
  openInObsidianViaClipboard,
  openInObsidianDirect,
} from './obsidian';

// ─── WebDAV ───────────────────────────────────────────────────────────

export {
  uploadMarkdown,
  uploadBackup,
} from './webdav';

// ─── Zip ──────────────────────────────────────────────────────────────

export {
  exportAsZip,
  zipToBlob,
} from './zip';

// ─── Scheduler ────────────────────────────────────────────────────────

export {
  scheduleAutoBackup,
  executeBackup,
  registerBackupAlarmListener,
  getNextBackupTime,
} from './scheduler';
export type { BackupDataProvider } from './scheduler';

// ─── Types ───────────────────────────────────────────────────────────

export type {
  ExportConfig,
  ObsidianConfig,
  NoteBehavior,
  WebDavConfig,
  S3Config,
  AutoBackupConfig,
  ExportTask,
  ExportTaskError,
  ExportErrorCode,
  ExportResult,
  ZipExportData,
  Property,
} from './types';

// ─── Frontmatter ─────────────────────────────────────────────────────

export {
  generateFrontmatter,
  buildPageFrontmatter,
} from './frontmatter';
