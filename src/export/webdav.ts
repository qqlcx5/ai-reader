/**
 * WebDAV Sync Client
 *
 * Uploads Markdown notes and backup JSON files to a WebDAV server.
 * Uses the `webdav` npm package for PUT operations with overwrite.
 *
 * Based on design-06-export-sync.md §5.
 */

import type { WebDavConfig, ExportResult, ExportTask } from './types';

// ─── Types ────────────────────────────────────────────────────────────

interface WebDavClient {
  putFileContents(path: string, content: string, options?: { overwrite: boolean }): Promise<boolean>;
}

// ─── Client Factory ───────────────────────────────────────────────────

let cachedClient: WebDavClient | null = null;

/**
 * Create or retrieve a cached WebDAV client.
 *
 * Uses dynamic import so the webdav package can be code-split.
 */
async function getClient(config: WebDavConfig): Promise<WebDavClient> {
  if (cachedClient) return cachedClient;

  try {
    // Dynamic import for code-splitting
    const { createClient } = await import('webdav');
    cachedClient = createClient(config.url, {
      username: config.username,
      password: config.password,
    }) as unknown as WebDavClient;
    return cachedClient;
  } catch {
    throw new Error(
      'webdav package not installed. Add it to dependencies: npm install webdav',
    );
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Upload a Markdown note to WebDAV.
 */
export async function uploadMarkdown(
  config: WebDavConfig,
  fileName: string,
  content: string,
): Promise<ExportResult> {
  const taskId = generateTaskId('webdav');

  try {
    if (!config.enabled) {
      return {
        success: false,
        taskId,
        error: { code: 'WEBDAV_UPLOAD_FAILED', message: 'WebDAV is not enabled in settings' },
      };
    }

    const client = await getClient(config);
    const path = `${config.backupPath.replace(/\/$/, '')}/${fileName}.md`;
    const uploaded = await client.putFileContents(path, content, { overwrite: true });

    if (uploaded) {
      return { success: true, taskId, remotePath: path };
    } else {
      return {
        success: false,
        taskId,
        error: { code: 'WEBDAV_UPLOAD_FAILED', message: 'Upload returned false' },
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = message.includes('401') || message.includes('403')
      ? 'WEBDAV_AUTH_FAILED' as const
      : 'WEBDAV_UPLOAD_FAILED' as const;

    return { success: false, taskId, error: { code, message } };
  }
}

/**
 * Upload a backup JSON file to WebDAV.
 */
export async function uploadBackup(
  config: WebDavConfig,
  data: string,
): Promise<ExportResult> {
  const taskId = generateTaskId('auto-backup');
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `ai-reader-backup-${dateStr}.json`;

  try {
    const client = await getClient(config);
    const path = `${config.backupPath.replace(/\/$/, '')}/${fileName}`;
    await client.putFileContents(path, data, { overwrite: true });
    return { success: true, taskId, remotePath: path };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, taskId, error: { code: 'WEBDAV_UPLOAD_FAILED', message } };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

let taskCounter = 0;

function generateTaskId(prefix: string): string {
  taskCounter = (taskCounter + 1) % 100000;
  return `${prefix}_${Date.now()}_${taskCounter}`;
}
