/**
 * Dexie database definition for AI Reader.
 *
 * Three tables:
 *   - `documents`     captured web pages
 *   - `chatHistories` chat sessions per document
 *   - `settings`      generic key/value settings
 *
 * Indexes use a leading primary key (`id` / `key`) followed by
 * the columns we filter or order by.
 */

import Dexie, { type Table } from 'dexie'
import type {
  CapturedDocument,
  ChatHistory,
  SettingsEntry,
} from './schema'

export class AIReaderDatabase extends Dexie {
  documents!: Table<CapturedDocument, string>
  chatHistories!: Table<ChatHistory, string>
  settings!: Table<SettingsEntry, string>

  constructor(name = 'AIReaderDB') {
    super(name)

    // Primary schema. Indexes are kept minimal for write speed.
    this.version(1).stores({
      documents: 'id, url, createdAt, updatedAt',
      chatHistories: 'id, documentId, createdAt, updatedAt',
      settings: 'key, updatedAt',
    })
  }
}

export const db = new AIReaderDatabase()
