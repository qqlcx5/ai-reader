/**
 * M7 — Export & Sync public surface.
 */
export * from './types';

// ── Obsidian ──────────────────────────────────────────────────────────────────
export {
  buildObsidianUri,
  buildSafeObsidianUri,
  buildObsidianMarkdown,
  byteLength,
  openObsidianUri,
  downloadAsMarkdown,
  sanitizeFileName,
  writeToObsidian,
  /** @alias writeToObsidian — kept for DailyBriefingCard compatibility */
  writeToObsidian as exportToObsidian,
  type ObsidianExportRecord,
} from './obsidian';

// ── Markdown rendering ────────────────────────────────────────────────────────
export {
  buildMarkdown,
  formatMessage,
  buildFrontMatter,
  type MarkdownInput,
} from './markdown';

// ── WebDAV ────────────────────────────────────────────────────────────────────
export {
  createWebDAVClient,
  testConnection,
  uploadNote,
  uploadBackup,
  ensureDir,
  joinPath,
  type WebDAVClient,
} from './webdav';

// ── ZIP export ────────────────────────────────────────────────────────────────
export {
  exportAll,
  exportZip,
  downloadZip,
  type ExportAllOptions,
  type ZipExportOptions,
  type ZipExportResult,
} from './zip';

// ── ZIP import ────────────────────────────────────────────────────────────────
export {
  importFromZip,
  type ImportStrategy,
  type ImportResult,
  type ImportProgressEvent,
} from './importer';

// ── Local file export ─────────────────────────────────────────────────────────
export {
  exportAsMarkdown,
  exportAsHtml,
  exportAsText,
  copyToClipboard,
  copyPlainToClipboard,
  type LocalExportRecord,
} from './local-file';

// ── Settings sync ─────────────────────────────────────────────────────────────
export {
  saveSettings,
  loadSettings,
  clearSyncedSettings,
  CHUNK_SIZE,
  type SyncableSettings,
} from './settings-sync';

// ── Scheduler ─────────────────────────────────────────────────────────────────
export {
  scheduleAutoBackup,
  cancelAutoBackup,
  computeNextDelay,
  AUTO_BACKUP_ALARM,
} from './scheduler';

// ── Options adapters ──────────────────────────────────────────────────────────
export {
  toWebDAVOptions,
  toObsidianOptions,
  hasWebDAVConfig,
  hasObsidianConfig,
} from './options';

// ── Full backup flow ──────────────────────────────────────────────────────────
export {
  collectBackupSnapshot,
  performWebDAVBackup,
  recordBackupSuccess,
  recordBackupError,
  snapshotSettings,
  type BackupSnapshot,
  type BackupResult,
} from './backup';

// ── View models ───────────────────────────────────────────────────────────────
export {
  toConversation,
  toMessages,
  toExportModels,
  type Conversation,
  type Message,
} from './view-models';
