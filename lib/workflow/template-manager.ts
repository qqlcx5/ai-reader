/**
 * M5 — Template Manager (提示词模板管理器).
 *
 * Manages prompt templates stored in the M8 `templates` table.
 * Responsibilities:
 *  - CRUD: create / update / delete / list templates.
 *  - Import / export `.json` files.
 *  - URL regex trigger matching.
 *  - Schema.org type trigger matching.
 *  - Compressed sync to `chrome.storage.sync` via lz-string.
 *
 * The "prompt templates" here are short chat starters (e.g. "总结摘要"),
 * distinct from workflow templates (roundtable / relay) managed by
 * modules/storage/repositories/workflow-template.repo.ts.
 */

import LZString from 'lz-string';
import { templateRepo } from '@/lib/db/repositories/template.repo';
import type { TemplateRecord } from '@/lib/db/types';

// ─── Sync constants ───────────────────────────────────────────────────────────

/** Maximum bytes per chrome.storage.sync value (leave headroom under 8192). */
const CHUNK_SIZE = 8000;
const SYNC_KEY_PREFIX = 'tpl_chunk_';
const SYNC_META_KEY   = 'tpl_meta';

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createTemplate(
  record: Omit<TemplateRecord, 'id' | 'createdAt'>,
): Promise<TemplateRecord> {
  const full: TemplateRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  await templateRepo.create(full);
  return full;
}

export async function updateTemplate(
  id: string,
  partial: Partial<Omit<TemplateRecord, 'id' | 'createdAt'>>,
): Promise<void> {
  await templateRepo.update(id, partial);
}

export async function deleteTemplate(id: string): Promise<void> {
  await templateRepo.delete(id);
}

export async function listTemplates(): Promise<TemplateRecord[]> {
  return templateRepo.listAll();
}

export async function getTemplate(id: string): Promise<TemplateRecord | undefined> {
  return templateRepo.findById(id);
}

// ─── URL / Schema trigger matching ───────────────────────────────────────────

/**
 * Return the first template whose `urlPattern` regex matches `url`,
 * or `null` if none match.
 */
export async function matchTemplate(url: string): Promise<TemplateRecord | null> {
  return templateRepo.matchByUrl(url);
}

/**
 * Return the first template whose `schemaType` matches `schemaType`,
 * or `null` if none match.
 */
export async function matchTemplateBySchema(
  schemaType: string,
): Promise<TemplateRecord | null> {
  return templateRepo.matchBySchema(schemaType);
}

// ─── Import / Export ─────────────────────────────────────────────────────────

/**
 * Export templates as a JSON blob string.
 * Pass an array of IDs to export specific ones, or omit to export all.
 */
export async function exportTemplates(ids?: string[]): Promise<string> {
  const all = await templateRepo.listAll();
  const selected = ids ? all.filter((t) => ids.includes(t.id)) : all;
  return JSON.stringify(selected, null, 2);
}

/**
 * Trigger a browser file download of the exported templates JSON.
 */
export function downloadTemplatesJson(json: string, filename = 'templates.json'): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import templates from a JSON string (`TemplateRecord[]` array).
 * Existing templates with the same `id` are skipped (non-destructive).
 * Returns the number of templates actually imported.
 */
export async function importTemplates(json: string): Promise<number> {
  let records: TemplateRecord[];
  try {
    records = JSON.parse(json) as TemplateRecord[];
  } catch {
    throw new Error('Invalid JSON: could not parse template file');
  }

  if (!Array.isArray(records)) {
    throw new Error('Invalid format: expected a JSON array of templates');
  }

  let count = 0;
  for (const rec of records) {
    if (!rec.id || !rec.name || !rec.prompt) continue;
    const existing = await templateRepo.findById(rec.id);
    if (!existing) {
      await templateRepo.create({
        ...rec,
        createdAt: rec.createdAt ?? Date.now(),
      });
      count++;
    }
  }
  return count;
}

// ─── lz-string compressed sync to chrome.storage.sync ────────────────────────

/**
 * Compress all templates and write them to `chrome.storage.sync` in chunks
 * of at most CHUNK_SIZE characters (UTF-16 encoded via lz-string).
 *
 * Layout:
 *  - `tpl_meta`        → { chunkCount: number, total: number }
 *  - `tpl_chunk_0`     → lz-string chunk 0
 *  - `tpl_chunk_1`     → lz-string chunk 1
 *  …
 */
export async function syncTemplatesToStorage(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) return;

  const all  = await templateRepo.listAll();
  const json = JSON.stringify(all);
  const compressed = LZString.compressToUTF16(json);

  // Split into chunks
  const chunks: string[] = [];
  for (let i = 0; i < compressed.length; i += CHUNK_SIZE) {
    chunks.push(compressed.slice(i, i + CHUNK_SIZE));
  }

  const toWrite: Record<string, unknown> = {
    [SYNC_META_KEY]: { chunkCount: chunks.length, total: all.length },
  };
  chunks.forEach((c, i) => {
    toWrite[`${SYNC_KEY_PREFIX}${i}`] = c;
  });

  await chrome.storage.sync.set(toWrite);
}

/**
 * Read templates from `chrome.storage.sync` (decompress and restore).
 * Returns `null` if no synced data exists.
 */
export async function loadTemplatesFromStorage(): Promise<TemplateRecord[] | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) return null;

  const metaResult = await chrome.storage.sync.get(SYNC_META_KEY);
  const meta = metaResult[SYNC_META_KEY] as { chunkCount: number; total: number } | undefined;

  if (!meta || meta.chunkCount === 0) return null;

  const keys = Array.from({ length: meta.chunkCount }, (_, i) => `${SYNC_KEY_PREFIX}${i}`);
  const chunkResult = await chrome.storage.sync.get(keys);

  const compressed = keys.map((k) => (chunkResult[k] as string) ?? '').join('');
  const json = LZString.decompressFromUTF16(compressed);
  if (!json) return null;

  try {
    return JSON.parse(json) as TemplateRecord[];
  } catch {
    return null;
  }
}

// ─── Seed data ────────────────────────────────────────────────────────────────

/**
 * Seed the 6 built-in prompt templates on first install.
 * Delegates to TemplateRepository.seedDefaultTemplates() which is idempotent.
 */
export async function seedDefaultTemplates(): Promise<void> {
  await templateRepo.seedDefaultTemplates();
}
