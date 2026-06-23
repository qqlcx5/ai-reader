/**
 * M7 — ZIP full-backup importer.
 *
 * Reads a backup zip produced by zip.worker.ts and merges its contents
 * into the local Dexie database according to the chosen strategy.
 *
 * Strategies:
 *  - `overwrite` — imported records replace local ones with the same id.
 *  - `skip`      — existing local records are preserved; only new ids are written.
 *
 * Returns `{ imported, skipped, errors }` for display in the UI.
 */
import JSZip from 'jszip';
import { getDb } from '@/modules/storage/db';
import type {
  ConversationRecord,
  MessageRecord,
  WorkflowTemplateRecord,
} from '@/modules/storage/types';
import type { HighlightRecord } from '@/lib/extraction/types';
import type { RssFeedRecord } from '@/modules/storage/types';

export type ImportStrategy = 'overwrite' | 'skip';

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface ImportProgressEvent {
  /** 0–1 fraction */
  progress: number;
  phase: string;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function importFromZip(
  file: File,
  strategy: ImportStrategy,
  onProgress?: (event: ImportProgressEvent) => void,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  onProgress?.({ progress: 0.05, phase: '解析 ZIP 文件…' });
  const zip = await JSZip.loadAsync(file);

  // Detect root folder (backup-{timestamp}/) — the zip may have one or be flat.
  const rootPrefix = detectRoot(zip);

  async function readJsonAsync<T>(path: string): Promise<T | null> {
    const f = zip.file(rootPrefix + path) ?? zip.file(path);
    if (!f) return null;
    try {
      const text = await f.async('string');
      return JSON.parse(text) as T;
    } catch (err) {
      result.errors.push(`解析 ${path} 失败: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // ── 1. Read index.json ─────────────────────────────────────────────────────
  onProgress?.({ progress: 0.1, phase: '读取 index.json…' });
  const conversations = (await readJsonAsync<ConversationRecord[]>('index.json')) ?? [];

  // ── 2. Collect all chat JSONs ──────────────────────────────────────────────
  onProgress?.({ progress: 0.2, phase: '读取对话数据…' });
  const allMessages: MessageRecord[] = [];
  const chatFiles = Object.keys(zip.files).filter((name) =>
    name.includes('/chats/') && name.endsWith('.json'),
  );
  for (const chatFile of chatFiles) {
    try {
      const text = await zip.files[chatFile].async('string');
      const parsed = JSON.parse(text) as { conversation?: ConversationRecord; messages?: MessageRecord[] };
      if (parsed.messages) allMessages.push(...parsed.messages);
    } catch (err) {
      result.errors.push(`解析 ${chatFile} 失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── 3. Read flat JSON files ────────────────────────────────────────────────
  onProgress?.({ progress: 0.4, phase: '读取高亮和模板…' });
  const highlights = (await readJsonAsync<HighlightRecord[]>('highlights.json')) ?? [];
  const templates = (await readJsonAsync<WorkflowTemplateRecord[]>('templates.json')) ?? [];
  const rssFeeds = (await readJsonAsync<RssFeedRecord[]>('rss-feeds.json')) ?? [];

  // ── 4. Write to Dexie ─────────────────────────────────────────────────────
  onProgress?.({ progress: 0.6, phase: '写入数据库…' });
  const db = getDb();

  await db.transaction('rw', [db.conversations, db.messages, db.highlights, db.rssFeeds, db.workflowTemplates], async () => {
    // Conversations
    for (const conv of conversations) {
      const existing = await db.conversations.get(conv.id);
      if (existing && strategy === 'skip') {
        result.skipped++;
      } else {
        await db.conversations.put(conv);
        result.imported++;
      }
    }

    // Messages
    for (const msg of allMessages) {
      const existing = await db.messages.get(msg.id);
      if (existing && strategy === 'skip') {
        result.skipped++;
      } else {
        await db.messages.put(msg);
        result.imported++;
      }
    }

    // Highlights
    for (const hl of highlights) {
      const existing = await db.highlights.get(hl.id);
      if (existing && strategy === 'skip') {
        result.skipped++;
      } else {
        await db.highlights.put(hl);
        result.imported++;
      }
    }

    // Workflow templates
    for (const tpl of templates) {
      if (!tpl.id || !tpl.name) continue; // skip prompt-template stubs
      const existing = await db.workflowTemplates.get(tpl.id);
      if (existing && strategy === 'skip') {
        result.skipped++;
      } else {
        await db.workflowTemplates.put(tpl);
        result.imported++;
      }
    }

    // RSS feeds
    for (const feed of rssFeeds) {
      const existing = await db.rssFeeds.get(feed.id);
      if (existing && strategy === 'skip') {
        result.skipped++;
      } else {
        await db.rssFeeds.put(feed);
        result.imported++;
      }
    }
  });

  onProgress?.({ progress: 1, phase: '完成' });
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detect the root folder prefix. Backups use `backup-{timestamp}/` as root.
 * If no such prefix is found, fall back to the empty string (flat layout).
 */
function detectRoot(zip: JSZip): string {
  for (const name of Object.keys(zip.files)) {
    const match = name.match(/^(backup-[^/]+\/)/);
    if (match) return match[1];
  }
  return '';
}
