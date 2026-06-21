/**
 * Export module — Core types
 *
 * Based on design-06-export-sync.md and obsidian-clipper's export patterns.
 */

// ─── Export Configuration ────────────────────────────────────────────

export interface ExportConfig {
  obsidian: ObsidianConfig;
  webdav: WebDavConfig;
  s3: S3Config;
  autoBackup: AutoBackupConfig;
}

export interface ObsidianConfig {
  enabled: boolean;
  vaultName: string;
  defaultFolder: string;
  /** Use &clipboard parameter for content (privacy-preserving) */
  useClipboard: boolean;
  /** Legacy mode: embed content directly in URI */
  legacyMode: boolean;
  /** Open silently without bringing Obsidian to foreground */
  silentOpen: boolean;
  /** Note behavior */
  behavior: NoteBehavior;
}

export type NoteBehavior =
  | 'overwrite'
  | 'append'
  | 'prepend'
  | 'append-daily'
  | 'prepend-daily';

export interface WebDavConfig {
  enabled: boolean;
  url: string;
  username: string;
  password: string;
  backupPath: string;
}

export interface S3Config {
  enabled: boolean;
  endpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  backupPath: string;
}

export interface AutoBackupConfig {
  enabled: boolean;
  /** Backup time (HH:MM), default 02:00 */
  time: string;
  /** Full or incremental */
  mode: 'full' | 'incremental';
  /** Target: webdav or s3 */
  target: 'webdav' | 's3';
}

// ─── Export Task ─────────────────────────────────────────────────────

export interface ExportTask {
  id: string;
  type: 'obsidian' | 'webdav' | 's3' | 'zip' | 'auto-backup';
  status: 'pending' | 'running' | 'done' | 'error';
  createdAt: number;
  completedAt?: number;
  error?: ExportTaskError;
}

export interface ExportTaskError {
  code: ExportErrorCode;
  message: string;
}

export type ExportErrorCode =
  | 'OBSIDIAN_NOT_INSTALLED'
  | 'OBSIDIAN_PROTOCOL_ERROR'
  | 'URI_TOO_LONG'
  | 'CLIPBOARD_FAILED'
  | 'WEBDAV_AUTH_FAILED'
  | 'WEBDAV_UPLOAD_FAILED'
  | 'WEBDAV_TIMEOUT'
  | 'S3_AUTH_FAILED'
  | 'S3_UPLOAD_FAILED'
  | 'ZIP_WORKER_FAILED'
  | 'ZIP_TOO_LARGE'
  | 'BACKUP_SCHEDULE_FAILED'
  | 'BACKUP_CONFLICT';

// ─── Export Result ───────────────────────────────────────────────────

export interface ExportResult {
  success: boolean;
  taskId: string;
  /** For Zip exports: the download URL */
  downloadUrl?: string;
  /** For Obsidian: the generated URI */
  obsidianUri?: string;
  /** For WebDAV/S3: the remote path */
  remotePath?: string;
  error?: ExportTaskError;
}

// ─── Zip Export Data Structure ───────────────────────────────────────

export interface ZipExportData {
  conversations: unknown[];
  messages: unknown[];
  settings: Record<string, unknown>;
  exportedAt: number;
  version: string;
}

// ─── Frontmatter ─────────────────────────────────────────────────────

export interface Property {
  name: string;
  value: string | number | boolean;
  type?: 'text' | 'number' | 'checkbox' | 'date' | 'datetime' | 'list';
}
