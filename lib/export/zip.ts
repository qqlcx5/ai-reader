/**
 * M7 — Zip export main-thread wrapper.
 *
 * Two entry points:
 *  - `exportAll()`: reads the full Dexie snapshot and downloads a structured backup zip.
 *  - `exportZip()`: low-level helper accepting pre-fetched data (kept for backup.ts compat).
 */
import type { ZipMessage, ZipAllInput } from './zip.worker';
import type { Settings } from '@/modules/storage/types';
import type { Conversation, Message } from './view-models';
import { getDb } from '@/modules/storage/db';

// ─── Legacy shape (kept for backward compat with backup.ts / SyncOptionsPanel) ─

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

// ─── New full-backup entry point ──────────────────────────────────────────────

export interface ExportAllOptions {
  /** Called with (progress 0-1, currentFileName). */
  onProgress?: (progress: number, file: string) => void;
}

/**
 * Read all Dexie tables, pack into the structured backup ZIP, and trigger
 * a browser download. Progress events are forwarded via `onProgress`.
 */
export async function exportAll(options: ExportAllOptions = {}): Promise<void> {
  const db = getDb();

  const [conversations, messages, highlights, rssFeeds, workflowTemplates] = await Promise.all([
    db.conversations.toArray(),
    db.messages.toArray(),
    db.highlights.toArray(),
    db.rssFeeds.toArray(),
    db.workflowTemplates.toArray(),
  ]);

  // Prompt templates live in Settings.prompts — pull from storage
  const { useSettingsStore } = await import('@/stores/settings.store');
  let promptTemplates: { id: string; name: string; content: string; mode?: string }[] = [];
  try {
    const store = useSettingsStore();
    promptTemplates = store.settings.prompts.map((p) => ({
      id: p.id,
      name: p.name,
      content: p.content,
      mode: p.mode,
    }));
  } catch {
    // settings store unavailable — omit templates
  }

  const input: ZipAllInput = {
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      preview: c.preview,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      mode: c.mode,
      activeProviderIds: c.activeProviderIds,
      messageCount: c.messageCount,
    })),
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      modelResponses: m.modelResponses,
      createdAt: m.createdAt,
    })),
    highlights: highlights.map((h) => ({
      id: h.id,
      pageId: h.pageId,
      selector: h.selector,
      text: h.text,
      style: h.style,
      createdAt: h.createdAt,
      url: h.url,
      domain: h.domain,
    })),
    templates: [
      ...promptTemplates,
      ...workflowTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        content: JSON.stringify(t),
        mode: t.type,
      })),
    ],
    rssFeeds: rssFeeds.map((f) => ({
      id: f.id,
      url: f.url,
      title: f.title,
      enabled: f.enabled,
      lastFetchedAt: f.lastFetchedAt,
    })),
  };

  const result = await runZipWorker(input, options.onProgress);
  downloadZip(result.blob, result.filename);
}

// ─── Low-level worker runner ──────────────────────────────────────────────────

const WORKER_URL = new URL('./zip.worker.ts', import.meta.url);

interface WorkerResult {
  blob: Blob;
  filename: string;
}

function runZipWorker(
  input: ZipAllInput,
  onProgress?: (progress: number, file: string) => void,
): Promise<WorkerResult> {
  return new Promise<WorkerResult>((resolve, reject) => {
    const worker = new Worker(WORKER_URL, { type: 'module' });

    worker.addEventListener('message', (event: MessageEvent<ZipMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'progress':
          onProgress?.(msg.progress, msg.file);
          break;
        case 'done':
          worker.terminate();
          resolve({ blob: msg.blob, filename: msg.filename });
          break;
        case 'error':
          worker.terminate();
          reject(new Error(msg.message));
          break;
      }
    });
    worker.addEventListener('error', (evt) => {
      worker.terminate();
      reject(new Error(evt.message || 'Worker error'));
    });
    worker.postMessage(input);
  });
}

// ─── Legacy exportZip (kept for backup.ts / SyncOptionsPanel compat) ─────────

export async function exportZip(options: ZipExportOptions): Promise<ZipExportResult> {
  // The legacy call only has conversations/messages/settings — wrap into ZipAllInput
  const input: ZipAllInput = {
    conversations: options.conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      mode: c.mode,
    })),
    messages: options.messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      createdAt: m.createdAt,
    })),
    highlights: [],
    templates: options.settings.prompts?.map((p) => ({
      id: p.id,
      name: p.name,
      content: p.content,
      mode: p.mode,
    })) ?? [],
    rssFeeds: [],
  };

  const result = await runZipWorker(input, (processed, _file) => {
    options.onProgress?.(Math.round(processed * 100), 100);
  });
  return { blob: result.blob, filename: result.filename, totalSize: result.blob.size };
}

// ─── Download helper ──────────────────────────────────────────────────────────

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
