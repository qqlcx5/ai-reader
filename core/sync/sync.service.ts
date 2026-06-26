import { db } from '@/db/dexie';
import { SCHEMA_VERSION } from '@/db/dexie';
import * as webdav from './webdav-client';
import type { WebDAVOptions } from './webdav-client';
import type { BackupData } from './backup-packager';

const REMOTE_DIR = '/ReadChat_Backup';

export async function syncUpload(options: WebDAVOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // 读取全量数据
    const documents = await db.documents.toArray();
    const chatHistories = await db.chatHistories.toArray();
    const settings = await db.settings.toArray();

    const data: BackupData = {
      schemaVersion: SCHEMA_VERSION,
      documents,
      chatHistories,
      settings,
      exportedAt: Date.now(),
      version: '1.0.0',
    };

    const json = JSON.stringify(data);
    const compressed = await webdav.gzipCompress(json);

    // 确保目录存在
    await webdav.mkcol(options, REMOTE_DIR);

    // 上传数据
    const dataResponse = await webdav.put(
      options,
      `${REMOTE_DIR}/ReadChat_data.json.gz`,
      compressed,
      'application/gzip',
    );

    if (!dataResponse.ok) {
      return { success: false, error: `上传失败: ${dataResponse.status}` };
    }

    // 上传 metadata
    const metadata = JSON.stringify({ updatedAt: Date.now(), schemaVersion: SCHEMA_VERSION });
    const metaResponse = await webdav.put(
      options,
      `${REMOTE_DIR}/metadata.json`,
      metadata,
      'application/json',
    );

    if (!metaResponse.ok) {
      return { success: false, error: `metadata 上传失败: ${metaResponse.status}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function syncDownload(options: WebDAVOptions): Promise<{ success: boolean; error?: string; localIsNewer?: boolean }> {
  try {
    // 读取远端 metadata
    const metaResponse = await webdav.get(options, `${REMOTE_DIR}/metadata.json`);
    if (!metaResponse.ok) {
      return { success: false, error: `无法读取远端 metadata: ${metaResponse.status}` };
    }

    const remoteMeta = await metaResponse.json() as { updatedAt: number };

    // 比较本地 lastSyncAt
    const lastSyncEntry = await db.settings.get('lastSyncAt');
    const localLastSync = (lastSyncEntry?.value as number) || 0;

    if (remoteMeta.updatedAt <= localLastSync) {
      return { success: true, localIsNewer: true };
    }

    // 下载数据
    const dataResponse = await webdav.get(options, `${REMOTE_DIR}/ReadChat_data.json.gz`);
    if (!dataResponse.ok) {
      return { success: false, error: `下载失败: ${dataResponse.status}` };
    }

    const compressed = await dataResponse.blob();
    const json = await webdav.gzipDecompress(compressed);
    const data = JSON.parse(json) as BackupData;

    if (data.schemaVersion !== SCHEMA_VERSION) {
      return { success: false, error: `版本不兼容: 远端 ${data.schemaVersion}，本地 ${SCHEMA_VERSION}` };
    }

    // 覆盖本地数据
    await db.transaction('rw', [db.documents, db.chatHistories, db.settings], async () => {
      await db.documents.clear();
      await db.chatHistories.clear();
      await db.settings.clear();

      if (data.documents.length > 0) await db.documents.bulkPut(data.documents as any[]);
      if (data.chatHistories.length > 0) await db.chatHistories.bulkPut(data.chatHistories as any[]);
      if (data.settings.length > 0) await db.settings.bulkPut(data.settings as any[]);
    });

    // 更新 lastSyncAt
    await db.settings.put({
      key: 'lastSyncAt',
      value: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
