/**
 * M6 — Public surface.
 */
export * from './types';
export {
  buildObsidianUri,
  buildSafeObsidianUri,
  byteLength,
  openObsidianUri,
  downloadAsMarkdown,
  sanitizeFileName,
} from './obsidian';
export {
  buildMarkdown,
  formatMessage,
  buildFrontMatter,
  type MarkdownInput,
} from './markdown';
export {
  createWebDAVClient,
  uploadNote,
  uploadBackup,
  ensureDir,
  joinPath,
  type WebDAVClient,
} from './webdav';
export { exportZip, downloadZip, type ZipExportOptions, type ZipExportResult } from './zip';
export {
  scheduleAutoBackup,
  cancelAutoBackup,
  computeNextDelay,
  AUTO_BACKUP_ALARM,
} from './scheduler';
export {
  toWebDAVOptions,
  toObsidianOptions,
  hasWebDAVConfig,
  hasObsidianConfig,
} from './options';
export {
  collectBackupSnapshot,
  performWebDAVBackup,
  recordBackupSuccess,
  recordBackupError,
  snapshotSettings,
  type BackupSnapshot,
  type BackupResult,
} from './backup';
export {
  toConversation,
  toMessages,
  toExportModels,
  type Conversation,
  type Message,
} from './view-models';
