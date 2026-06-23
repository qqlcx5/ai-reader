import JSZip from 'jszip';
import { getDb } from '@/modules/storage/db';
import { pageRepo } from '@/modules/storage/repositories/page.repo';

export type MergeStrategy = 'skip' | 'overwrite';

export interface ImportStats {
  pages: { imported: number; skipped: number; errors: number };
  conversations: { imported: number; skipped: number };
  messages: { imported: number; skipped: number };
}

/** Parse a JSON string into backup data */
export function parseBackupJson(json: string): unknown {
  return JSON.parse(json);
}

/** Extract the main backup.json from a ZIP ArrayBuffer */
export async function extractBackupFromZip(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file('backup.json') ?? zip.file(Object.keys(zip.files)[0]);
  if (!entry) throw new Error('ZIP 中未找到 backup.json');
  return entry.async('string');
}

/** Import a backup into the local database with the given merge strategy */
export async function importBackup(
  data: unknown,
  strategy: MergeStrategy = 'skip',
): Promise<ImportStats> {
  const stats: ImportStats = {
    pages: { imported: 0, skipped: 0, errors: 0 },
    conversations: { imported: 0, skipped: 0 },
    messages: { imported: 0, skipped: 0 },
  };

  if (typeof data !== 'object' || data === null) throw new Error('无效的备份格式');
  const backup = data as Record<string, unknown>;

  const db = getDb();

  // Import conversations
  if (Array.isArray(backup.conversations)) {
    for (const conv of backup.conversations) {
      try {
        const exists = await db.conversations.get((conv as Record<string, string>).id);
        if (exists && strategy === 'skip') {
          stats.conversations.skipped++;
          continue;
        }
        await db.conversations.put(conv as never);
        stats.conversations.imported++;
      } catch {
        // ignore individual errors
      }
    }
  }

  // Import messages
  if (Array.isArray(backup.messages)) {
    for (const msg of backup.messages) {
      try {
        const exists = await db.messages.get((msg as Record<string, string>).id);
        if (exists && strategy === 'skip') {
          stats.messages.skipped++;
          continue;
        }
        await db.messages.put(msg as never);
        stats.messages.imported++;
      } catch {
        // ignore individual errors
      }
    }
  }

  // Import pages (if the backup includes a pages array)
  if (Array.isArray(backup.pages)) {
    for (const page of backup.pages) {
      try {
        const exists = await pageRepo.findById((page as Record<string, string>).id);
        if (exists && strategy === 'skip') {
          stats.pages.skipped++;
          continue;
        }
        await pageRepo.upsert(page as never);
        stats.pages.imported++;
      } catch {
        stats.pages.errors++;
      }
    }
  }

  return stats;
}
