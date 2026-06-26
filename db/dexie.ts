import Dexie, { type EntityTable } from 'dexie';
import type { CapturedDocument, ChatHistory, SettingsEntry } from './schema';

export const SCHEMA_VERSION = 1;

export const db = new Dexie('ReadChatDB') as Dexie & {
  documents: EntityTable<CapturedDocument, 'id'>;
  chatHistories: EntityTable<ChatHistory, 'id'>;
  settings: EntityTable<SettingsEntry, 'key'>;
};

db.version(SCHEMA_VERSION).stores({
  documents: 'id, url, title, createdAt, updatedAt',
  chatHistories: 'id, documentId, createdAt, updatedAt',
  settings: 'key, updatedAt',
});
