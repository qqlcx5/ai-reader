/**
 * M6 — Zip export main-thread wrapper.
 *
 * Spawns a dedicated web worker to package conversations / messages /
 * settings into a zip blob, then triggers a download. Progress events
 * are forwarded to the caller via the optional callback.
 */
import type { ZipMessage } from './zip.worker';
import type { Settings } from '@/modules/storage/types';
import type { Conversation, Message } from './view-models';

export interface ZipExportOptions {
  conversations: Conversation[];
  messages: Message[];
  settings: Settings;
  onProgress?: (processed: number, total: number) => void;
}

export interface ZipExportResult {
  blob: Blob;
  filename: string;
  totalSize: number;
}

const WORKER_URL = new URL('./zip.worker.ts', import.meta.url);

export async function exportZip(options: ZipExportOptions): Promise<ZipExportResult> {
  const worker = new Worker(WORKER_URL, { type: 'module' });

  return new Promise<ZipExportResult>((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<ZipMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'progress':
          options.onProgress?.(msg.processed, msg.total);
          break;
        case 'done':
          worker.terminate();
          resolve({ blob: msg.blob, filename: msg.filename, totalSize: msg.totalSize });
          break;
        case 'error':
          worker.terminate();
          reject(new Error(msg.message));
          break;
      }
    });
    worker.addEventListener('error', (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Worker error'));
    });
    worker.postMessage({
      conversations: options.conversations,
      messages: options.messages,
      settings: options.settings,
    });
  });
}

/** Trigger a browser download for a zip blob. */
export function downloadZip(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}
