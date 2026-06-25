/**
 * Dexie IndexedDB 数据库
 * 参考 doc/tasks/persistence.md 章节 1
 * 使用 Dexie 4.x + 异步迁移
 */
import Dexie, { type Table } from 'dexie';
import type {
  CapturedDocument,
  ChatHistory,
  ModelProviderConfig,
  AppSettings,
} from '@/shared/types';

export const SCHEMA_VERSION = 1;

class ReadChatDB extends Dexie {
  documents!: Table<CapturedDocument, string>;
  chatHistories!: Table<ChatHistory, string>;
  models!: Table<ModelProviderConfig, string>;
  settings!: Table<{ key: string; value: unknown; updatedAt: number }, string>;

  constructor() {
    super('ReadChatDB');

    this.version(1).stores({
      documents: 'id, url, title, createdAt, updatedAt, *keywords',
      chatHistories: 'id, documentId, createdAt, updatedAt',
      models: 'id, name, enabled, createdAt, updatedAt',
      settings: 'key, updatedAt',
    });
  }
}

export const db = new ReadChatDB();

// 工具方法
export const SETTINGS_KEYS = {
  APP_SETTINGS: 'app_settings',
  LAST_SYNC_AT: 'last_sync_at',
} as const;

export async function getAppSettings(): Promise<AppSettings> {
  const row = await db.settings.get(SETTINGS_KEYS.APP_SETTINGS);
  return (row?.value as AppSettings) || {};
}

export async function setAppSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({
    key: SETTINGS_KEYS.APP_SETTINGS,
    value: settings,
    updatedAt: Date.now(),
  });
}

export async function getLastSyncAt(): Promise<number | undefined> {
  const row = await db.settings.get(SETTINGS_KEYS.LAST_SYNC_AT);
  return row?.value as number | undefined;
}

export async function setLastSyncAt(timestamp: number): Promise<void> {
  await db.settings.put({
    key: SETTINGS_KEYS.LAST_SYNC_AT,
    value: timestamp,
    updatedAt: Date.now(),
  });
}
