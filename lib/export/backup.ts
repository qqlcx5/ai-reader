/**
 * M6 — Full backup flow.
 *
 * 1. Read conversations / messages / settings from M7 storage.
 * 2. Map storage records to the flattened export view models.
 * 3. Serialize to a single JSON payload.
 * 4. Upload to WebDAV (or return the JSON for manual export).
 * 5. Update `lastBackupAt` / `lastBackupError` on the settings.
 *
 * Backup always strips API keys from the uploaded payload, regardless of
 * `exportConfig.includeApiKeys` (that flag only governs manual zip export,
 * where the user explicitly opts in).
 */
import { getDb } from '@/modules/storage/db';
import type {
  ConversationRecord,
  MessageRecord,
  Settings,
  ExportConfig,
} from '@/modules/storage/types';
import { useSettingsStore } from '@/stores/settings.store';
import { createWebDAVClient, uploadBackup } from './webdav';
import { toExportModels, type Conversation, type Message } from './view-models';
import { toWebDAVOptions } from './options';

export interface BackupSnapshot {
  conversations: Conversation[];
  messages: Message[];
  settings: Settings;
  generatedAt: number;
}

/**
 * Pull the full dataset from Dexie. Messages are streamed via `each` so
 * we never hold a long read transaction open for very large datasets.
 */
export async function collectBackupSnapshot(): Promise<BackupSnapshot> {
  const db = getDb();
  const conversations: ConversationRecord[] = await db.conversations.toArray();
  const messages: MessageRecord[] = [];
  await db.messages.orderBy('conversationId').each((m) => {
    messages.push(m);
  });
  const view = toExportModels(conversations, messages);
  return {
    conversations: view.conversations,
    messages: view.messages,
    settings: await snapshotSettings(),
    generatedAt: Date.now(),
  };
}

/** Read the current settings; falls back to defaults if the store is unset. */
export async function snapshotSettings(): Promise<Settings> {
  try {
    const store = useSettingsStore();
    return JSON.parse(JSON.stringify(store.settings)) as Settings;
  } catch {
    // Pinia not initialised (e.g. unit test without a Pinia root) —
    // best-effort defaults so backup can still run.
    const { defaultSettings } = await import('@/modules/storage/types');
    return JSON.parse(JSON.stringify(defaultSettings)) as Settings;
  }
}

export interface BackupResult {
  remotePath?: string;
  bytes: number;
  snapshot: BackupSnapshot;
}

export async function performWebDAVBackup(config: ExportConfig): Promise<BackupResult> {
  const options = toWebDAVOptions(config);
  const snapshot = await collectBackupSnapshot();
  // Always strip API keys from the remote backup payload.
  const safeSettings: Settings = {
    ...snapshot.settings,
    providers: snapshot.settings.providers.map((p) => ({ ...p, apiKey: '' })),
  };
  const payload: BackupSnapshot = {
    ...snapshot,
    settings: safeSettings,
  };
  const json = JSON.stringify(payload, null, 2);
  const client = createWebDAVClient(options);
  const remotePath = await uploadBackup(client, options, json);
  return { remotePath, bytes: json.length, snapshot: payload };
}

export async function recordBackupSuccess(at: number): Promise<void> {
  try {
    const store = useSettingsStore();
    store.setSettings({
      exportConfig: {
        ...store.settings.exportConfig,
        lastBackupAt: at,
        lastBackupError: undefined,
      },
    });
  } catch {
    // settings store not initialised — best effort only
  }
}

export async function recordBackupError(message: string): Promise<void> {
  try {
    const store = useSettingsStore();
    store.setSettings({
      exportConfig: {
        ...store.settings.exportConfig,
        lastBackupError: message,
      },
    });
  } catch {
    // best effort
  }
}
