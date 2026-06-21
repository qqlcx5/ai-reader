/**
 * M6 — Zip export Web Worker.
 *
 * The worker pulls conversations / messages / settings from Dexie and
 * packages them as a zip using jszip. We offload the work so that
 * 1GB+ exports don't block the main UI thread.
 *
 * Vite picks this file up via the `new Worker(new URL(...), { type: 'module' })`
 * pattern used by `zip.ts`.
 */
/// <reference lib="webworker" />

import JSZip from 'jszip';
import type { Settings } from '@/modules/storage/types';
import type { Conversation, Message } from './view-models';

declare const self: DedicatedWorkerGlobalScope;

export interface ZipInput {
  conversations: Conversation[];
  messages: Message[];
  settings: Settings;
}

export interface ZipProgress {
  type: 'progress';
  processed: number;
  total: number;
}

export interface ZipDone {
  type: 'done';
  blob: Blob;
  filename: string;
  totalSize: number;
}

export interface ZipError {
  type: 'error';
  message: string;
}

export type ZipMessage = ZipProgress | ZipDone | ZipError;

self.addEventListener('message', async (event: MessageEvent<ZipInput>) => {
  try {
    const { conversations, messages, settings } = event.data;
    const zip = new JSZip();

    const manifest = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      generator: 'ai-reader',
      counts: {
        conversations: conversations.length,
        messages: messages.length,
      },
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Conversations as a single JSON array (small enough to be one file).
    zip.file('conversations.json', JSON.stringify(conversations, null, 2));

    // Messages: use JSONL so we can stream large datasets. Each line is a
    // full Message object. We deliberately drop the `id` field — it can
    // be regenerated on re-import to avoid PK collisions.
    const messageLines: string[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      messageLines.push(JSON.stringify(m));
      if (i % 200 === 0) {
        const msg: ZipProgress = { type: 'progress', processed: i, total: messages.length };
        self.postMessage(msg);
      }
    }
    zip.file('messages.jsonl', messageLines.join('\n'));

    // Settings: strip API keys unless the user explicitly opted in via
    // `exportConfig.includeApiKeys`.
    const includeKeys = settings.exportConfig?.includeApiKeys === true;
    const safeSettings: Settings = includeKeys
      ? settings
      : {
          ...settings,
          providers: settings.providers.map((p) => ({ ...p, apiKey: '' })),
        };
    zip.file('settings.json', JSON.stringify(safeSettings, null, 2));

    const blob = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
      (meta) => {
        const msg: ZipProgress = {
          type: 'progress',
          processed: meta.percent,
          total: 100,
        };
        self.postMessage(msg);
      },
    );

    const date = new Date().toISOString().split('T')[0];
    const filename = `ai-reader-export-${date}.zip`;
    const done: ZipDone = {
      type: 'done',
      blob,
      filename,
      totalSize: blob.size,
    };
    self.postMessage(done);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error: ZipError = { type: 'error', message };
    self.postMessage(error);
  }
});

// Mark as a module for tooling; not consumed at runtime.
export {};
