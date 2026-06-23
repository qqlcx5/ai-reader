/**
 * M7 — Zip export Web Worker (full backup structure).
 *
 * Receives a full snapshot from the main thread and packages it as:
 *   backup-{timestamp}/
 *     index.json                 all conversation metadata
 *     articles/{pageId}.md       per-conversation context snapshot (Markdown)
 *     chats/{pageId}.json        per-conversation full chat JSON
 *     highlights.json            all highlight records
 *     templates.json             prompt templates
 *     rss-feeds.json             RSS feed configs
 *
 * Progress: postMessage({ type:'progress', progress: 0–1, file: filename })
 * Done:     postMessage({ type:'done', blob, filename })
 * Error:    postMessage({ type:'error', message })
 */
/// <reference lib="webworker" />

import JSZip from 'jszip';

declare const self: DedicatedWorkerGlobalScope;

// ─── Input types (plain serialisable shapes, no Dexie imports) ───────────────

export interface ConvData {
  id: string;
  title: string;
  preview?: string;
  createdAt: number;
  updatedAt: number;
  mode: string;
  activeProviderIds?: string[];
  messageCount?: number;
}

export interface MsgData {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  modelResponses?: { providerId: string; modelId?: string; content: string }[];
  createdAt: number;
}

export interface HighlightData {
  id: string;
  pageId: string;
  selector: string;
  text: string;
  style: string;
  createdAt: number;
  url?: string;
  domain?: string;
}

export interface TemplateData {
  id: string;
  name: string;
  content: string;
  mode?: string;
}

export interface RssFeedData {
  id: string;
  url: string;
  title?: string;
  enabled?: boolean;
  lastFetchedAt?: number;
}

export interface ZipAllInput {
  conversations: ConvData[];
  messages: MsgData[];
  highlights: HighlightData[];
  templates: TemplateData[];
  rssFeeds: RssFeedData[];
}

// ─── Output message types ────────────────────────────────────────────────────

export interface ZipProgress {
  type: 'progress';
  /** 0–1 fraction of work completed */
  progress: number;
  /** Human-readable label for the currently processed file */
  file: string;
}

export interface ZipDone {
  type: 'done';
  blob: Blob;
  filename: string;
}

export interface ZipError {
  type: 'error';
  message: string;
}

export type ZipMessage = ZipProgress | ZipDone | ZipError;

// ─── Worker handler ───────────────────────────────────────────────────────────

self.addEventListener('message', async (event: MessageEvent<ZipAllInput>) => {
  try {
    const { conversations, messages, highlights, templates, rssFeeds } = event.data;
    const zip = new JSZip();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const root = `backup-${timestamp}`;

    // Total work units: fixed files + 1 per conversation (covers articles + chats together)
    const FIXED_FILES = 4; // index, highlights, templates, rss-feeds
    const total = FIXED_FILES + conversations.length;
    let done = 0;

    function progress(file: string) {
      done++;
      const msg: ZipProgress = { type: 'progress', progress: done / total, file };
      self.postMessage(msg);
    }

    // ── index.json ──────────────────────────────────────────────────────────
    zip.file(`${root}/index.json`, JSON.stringify(conversations, null, 2));
    progress('index.json');

    // ── articles/{pageId}.md & chats/{pageId}.json ──────────────────────────
    const msgByConv = new Map<string, MsgData[]>();
    for (const m of messages) {
      const list = msgByConv.get(m.conversationId) ?? [];
      list.push(m);
      msgByConv.set(m.conversationId, list);
    }

    for (const conv of conversations) {
      const convMsgs = msgByConv.get(conv.id) ?? [];
      zip.file(`${root}/articles/${conv.id}.md`, buildArticleMd(conv, convMsgs));
      zip.file(`${root}/chats/${conv.id}.json`, JSON.stringify({ conversation: conv, messages: convMsgs }, null, 2));
      progress(`chats/${conv.id}.json`);
    }

    // ── highlights.json ─────────────────────────────────────────────────────
    zip.file(`${root}/highlights.json`, JSON.stringify(highlights, null, 2));
    progress('highlights.json');

    // ── templates.json ──────────────────────────────────────────────────────
    zip.file(`${root}/templates.json`, JSON.stringify(templates, null, 2));
    progress('templates.json');

    // ── rss-feeds.json ──────────────────────────────────────────────────────
    zip.file(`${root}/rss-feeds.json`, JSON.stringify(rssFeeds, null, 2));
    progress('rss-feeds.json');

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const date = new Date().toISOString().split('T')[0];
    const doneMsg: ZipDone = { type: 'done', blob, filename: `readchat-backup-${date}.zip` };
    self.postMessage(doneMsg);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', message } satisfies ZipError);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildArticleMd(conv: ConvData, msgs: MsgData[]): string {
  const lines: string[] = [
    `# ${conv.title}`,
    '',
    `- mode: ${conv.mode}`,
    `- created: ${new Date(conv.createdAt).toISOString()}`,
    `- updated: ${new Date(conv.updatedAt).toISOString()}`,
    '',
  ];

  // Include the first system message as the article context snapshot
  const systemMsg = msgs.find((m) => m.role === 'system');
  if (systemMsg?.content) {
    lines.push('## Context Snapshot', '', systemMsg.content.trim(), '');
  } else if (conv.preview) {
    lines.push('## Preview', '', conv.preview.trim(), '');
  }

  return lines.join('\n');
}

export {};
