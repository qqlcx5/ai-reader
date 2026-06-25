/**
 * 导入导出服务
 * 参考 doc/tasks/persistence.md 章节 3
 * 参考 doc/tasks/sync.md 章节 5
 */
import type { BackupPackage, CapturedDocument, ChatHistory, ModelProviderConfig, AppSettings } from '@/shared/types';
import { exportAll, bulkPutDocuments } from '@/db/document-repository';
import { db } from '@/db/dexie';
import { listAllChatHistories } from '@/db/chat-repository';
import { listModels, putModel } from '@/db/model-repository';
import { getAppSettings, setAppSettings } from '@/db/dexie';
import { putFile, getFile } from './webdav.client';
import type { WebdavConfig } from './webdav.client';

const SCHEMA_VERSION = 1;
const VERSION = '1.0.0';

/**
 * 构建备份包
 */
export async function buildBackupPackage(): Promise<BackupPackage> {
  const [documents, chatHistories, models, settings] = await Promise.all([
    exportAll(),
    listAllChatHistories(),
    listModels(),
    getAppSettings(),
  ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    documents,
    chatHistories,
    models,
    settings,
    exportedAt: Date.now(),
    version: VERSION,
  };
}

/**
 * 导出为 JSON 文件下载
 */
export async function exportBackup(): Promise<void> {
  const pkg = await buildBackupPackage();
  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `readchat-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 导入备份
 */
export async function importBackup(file: File): Promise<{ success: boolean; message: string }> {
  const text = await file.text();
  let pkg: BackupPackage;
  try {
    pkg = JSON.parse(text);
  } catch (err) {
    return { success: false, message: '❌ 文件格式错误' };
  }
  if (pkg.schemaVersion !== SCHEMA_VERSION) {
    return { success: false, message: `❌ 不支持的 schema 版本: ${pkg.schemaVersion}` };
  }

  // 1. 文档
  if (pkg.documents?.length) {
    await bulkPutDocuments(pkg.documents);
  }
  // 2. 聊天历史
  if (pkg.chatHistories?.length) {
    await db.chatHistories.bulkPut(pkg.chatHistories);
  }
  // 3. 模型
  for (const m of pkg.models || []) {
    await putModel(m);
  }
  // 4. 设置（除了 secret）
  if (pkg.settings) {
    const { webdavPassword: _wp, ...safeSettings } = pkg.settings as AppSettings;
    await setAppSettings(safeSettings as AppSettings);
  }

  return {
    success: true,
    message: `✅ 导入成功：${pkg.documents?.length || 0} 文档，${pkg.chatHistories?.length || 0} 聊天`,
  };
}

/**
 * 上传到 WebDAV
 */
export async function uploadToWebdav(config: WebdavConfig): Promise<void> {
  const pkg = await buildBackupPackage();
  const filename = `readchat-${new Date().toISOString().slice(0, 10)}.json`;
  await putFile(config, filename, JSON.stringify(pkg));
  const { setLastSyncAt } = await import('@/db/dexie');
  await setLastSyncAt(Date.now());
}

/**
 * 从 WebDAV 下载最新备份并合并
 */
export async function downloadFromWebdav(config: WebdavConfig): Promise<{ success: boolean; message: string }> {
  // 简单策略：下载 readchat-latest.json
  const text = await getFile(config, 'readchat-latest.json');
  if (!text) {
    return { success: false, message: '❌ 未找到备份' };
  }
  try {
    const pkg: BackupPackage = JSON.parse(text);
    if (pkg.schemaVersion !== SCHEMA_VERSION) {
      return { success: false, message: `❌ 不支持的 schema 版本: ${pkg.schemaVersion}` };
    }
    // 合并策略：仅添加不存在的
    if (pkg.documents?.length) {
      const existing = await exportAll();
      const existingIds = new Set(existing.map((d) => d.id));
      const newDocs = pkg.documents.filter((d) => !existingIds.has(d.id));
      if (newDocs.length) await bulkPutDocuments(newDocs);
    }
    const { setLastSyncAt } = await import('@/db/dexie');
    await setLastSyncAt(Date.now());
    return { success: true, message: '✅ 同步成功' };
  } catch (err) {
    return { success: false, message: `❌ 解析失败: ${err instanceof Error ? err.message : String(err)}` };
  }
}
