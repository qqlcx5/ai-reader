/**
 * Zip Export with Web Worker
 *
 * Packages all user data (conversations, messages, settings sans API keys)
 * into a downloadable .zip file.  Offloads the JSZip generation to a
 * Web Worker so the main thread stays responsive during archiving.
 *
 * Based on design-06-export-sync.md §6.
 */

import type { ExportResult, ZipExportData } from './types';

// ─── Worker Code (inlined as Blob URL) ───────────────────────────────

/**
 * Generate the Web Worker as a Blob URL.
 * In production, use Vite/Webpack worker-loader or new URL() syntax.
 * This approach works in all bundler-free Chrome extension contexts.
 */
function createWorker(): Worker {
  const workerCode = `
    // JSZip will be imported via importScripts
    self.onmessage = async function(event) {
      const { conversations, messages, settings } = event.data;

      try {
        // importScripts loads JSZip from the extension's own files
        // In development, use a CDN; in production, bundle with the extension
        if (typeof JSZip === 'undefined') {
          self.postMessage({ error: 'JSZip not loaded. Ensure jszip is included in the extension.' });
          return;
        }

        const zip = new JSZip();

        zip.file('manifest.json', JSON.stringify({
          version: '1.0',
          exportedAt: Date.now(),
          exportedAtISO: new Date().toISOString(),
          totalConversations: conversations?.length || 0,
          totalMessages: messages?.length || 0,
        }, null, 2));

        zip.file('conversations.json', JSON.stringify(conversations, null, 2));
        zip.file('messages.jsonl', (messages || []).map(m => JSON.stringify(m)).join('\\n'));
        zip.file('settings.json', JSON.stringify(settings, null, 2));

        const blob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        });

        self.postMessage({ blob });
      } catch (err) {
        self.postMessage({ error: err.message || 'Unknown zip worker error' });
      }
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

// ─── Public API ──────────────────────────────────────────────────────

let taskCounter = 0;

/**
 * Export all data as a downloadable .zip file.
 *
 * @returns ExportResult with downloadUrl for the generated blob.
 */
export async function exportAsZip(
  conversations: unknown[],
  messages: unknown[],
  settings: Record<string, unknown>,
): Promise<ExportResult> {
  const taskId = `zip_${Date.now()}_${++taskCounter}`;

  // Strip API keys from settings before export
  const safeSettings = sanitizeSettings(settings);

  return new Promise((resolve) => {
    try {
      const worker = createWorker();
      let resolved = false;

      worker.onmessage = (event) => {
        if (resolved) return;
        resolved = true;
        worker.terminate();

        if (event.data.error) {
          resolve({
            success: false,
            taskId,
            error: { code: 'ZIP_WORKER_FAILED', message: event.data.error },
          });
          return;
        }

        const blob: Blob = event.data.blob;
        const url = URL.createObjectURL(blob);

        // Auto-trigger download
        triggerDownload(url, `ai-reader-export-${getDateStr()}.zip`);

        resolve({
          success: true,
          taskId,
          downloadUrl: url,
        });
      };

      worker.onerror = (err) => {
        if (resolved) return;
        resolved = true;
        worker.terminate();
        resolve({
          success: false,
          taskId,
          error: { code: 'ZIP_WORKER_FAILED', message: err.message },
        });
      };

      worker.postMessage({
        conversations,
        messages,
        settings: safeSettings,
      });
    } catch (err) {
      resolve({
        success: false,
        taskId,
        error: {
          code: 'ZIP_WORKER_FAILED',
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  });
}

/**
 * Export data and return a Blob (without auto-download).
 * Useful for programmatic use or custom download UIs.
 */
export async function zipToBlob(data: ZipExportData): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const worker = createWorker();
      let resolved = false;

      worker.onmessage = (event) => {
        if (resolved) return;
        resolved = true;
        worker.terminate();
        resolve(event.data.error ? null : event.data.blob);
      };

      worker.onerror = () => {
        if (resolved) return;
        resolved = true;
        worker.terminate();
        resolve(null);
      };

      worker.postMessage(data);
    } catch {
      resolve(null);
    }
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sanitizeSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    // Strip API keys and passwords
    if (
      typeof key === 'string' &&
      (key.toLowerCase().includes('apikey') ||
        key.toLowerCase().includes('api_key') ||
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('token'))
    ) {
      safe[key] = '[REDACTED]';
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Clean up after a short delay
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
