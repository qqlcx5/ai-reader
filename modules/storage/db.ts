import Dexie, { type EntityTable } from 'dexie';
import {
  type ConversationRecord,
  type MessageRecord,
  type RssFeedRecord,
  type RssItemRecord,
} from './types';

/**
 * M7 Storage & Data Layer — Dexie database
 *
 * Schema design:
 *  - conversations: metadata-only, no long bodies
 *  - messages: long content / modelResponses stored here, lazy-loaded
 *  - rssItems / rssFeeds: RSS pipeline tables
 *
 * Migration path is versioned explicitly. Each .version() can only modify
 * stores/indexes; use .upgrade() for data transformations.
 */
export class AiReaderDB extends Dexie {
  conversations!: EntityTable<ConversationRecord, 'id'>;
  messages!: EntityTable<MessageRecord, 'id'>;
  rssItems!: EntityTable<RssItemRecord, 'id'>;
  rssFeeds!: EntityTable<RssFeedRecord, 'id'>;

  constructor(name = 'AiReaderDB') {
    super(name);

    this.version(1).stores({
      conversations: 'id, updatedAt, title, mode',
      messages: 'id, conversationId, parentId, createdAt',
      rssItems: 'id, feedId, pubDate, isRead, hash',
      rssFeeds: 'id, url, enabled, lastFetchedAt',
    });

    // Version 2: add compound index for conversation messages ordering
    // and pre-stage FTS fields (phase 2 will populate them).
    this.version(2).stores({
      conversations: 'id, updatedAt, title, mode',
      messages: 'id, [conversationId+createdAt], parentId, createdAt',
      rssItems: 'id, [feedId+pubDate], isRead, hash',
      rssFeeds: 'id, url, enabled, lastFetchedAt',
    });

    // Version 3 (phase 2): enable full-text search index on messages.
    // We keep the schema declaration here but do not populate the FTS
    // table until the worker search is replaced by FTS in a later phase.
    this.version(3).stores({
      conversations: 'id, updatedAt, title, mode',
      messages: 'id, [conversationId+createdAt], parentId, createdAt',
      messageFts: '++id, messageId',
      rssItems: 'id, [feedId+pubDate], isRead, hash',
      rssFeeds: 'id, url, enabled, lastFetchedAt',
    });

    this.open().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[AiReaderDB] Failed to open database', err);
      throw err;
    });
  }
}

let _db: AiReaderDB | null = null;

export function getDb(): AiReaderDB {
  if (!_db) {
    _db = new AiReaderDB();
  }
  return _db;
}

export function resetDbForTests(name?: string): AiReaderDB {
  _db = new AiReaderDB(name || 'AiReaderDB-Test');
  return _db;
}

export { Dexie };
