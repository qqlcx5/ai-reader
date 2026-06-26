import LZString from 'lz-string';
import { db } from '@/db/dexie';
import { SCHEMA_VERSION } from '@/db/dexie';

export interface BackupData {
  schemaVersion: number;
  documents: unknown[];
  chatHistories: unknown[];
  settings: unknown[];
  exportedAt: number;
  version: string;
}

export async function exportBackup(): Promise<BackupData> {
  const documents = await db.documents.toArray();
  const chatHistories = await db.chatHistories.toArray();
  const settings = await db.settings.toArray();

  return {
    schemaVersion: SCHEMA_VERSION,
    documents,
    chatHistories,
    settings,
    exportedAt: Date.now(),
    version: '1.0.0',
  };
}

export function downloadBackup(data: BackupData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ReadChat_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importBackup(jsonString: string): Promise<{ success: boolean; error?: string }> {
  let data: BackupData;
  try {
    data = JSON.parse(jsonString) as BackupData;
  } catch {
    return { success: false, error: 'JSON 解析失败' };
  }

  if (data.schemaVersion !== SCHEMA_VERSION) {
    return {
      success: false,
      error: `版本不兼容：备份版本 ${data.schemaVersion}，当前版本 ${SCHEMA_VERSION}`,
    };
  }

  if (!data.documents || !data.chatHistories || !data.settings) {
    return { success: false, error: '备份数据格式不完整' };
  }

  try {
    await db.transaction('rw', [db.documents, db.chatHistories, db.settings], async () => {
      await db.documents.clear();
      await db.chatHistories.clear();
      await db.settings.clear();

      if (data.documents.length > 0) await db.documents.bulkPut(data.documents as any[]);
      if (data.chatHistories.length > 0) await db.chatHistories.bulkPut(data.chatHistories as any[]);
      if (data.settings.length > 0) await db.settings.bulkPut(data.settings as any[]);
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: `导入失败: ${String(err)}` };
  }
}

/** 压缩 rawHtml */
export function compressRawHtml(html: string): string {
  return LZString.compressToUTF16(html);
}

/** 解压 rawHtml */
export function decompressRawHtml(compressed: string): string {
  return LZString.decompressFromUTF16(compressed) || '';
}
