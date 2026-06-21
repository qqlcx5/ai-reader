/**
 * M7 Storage & Data Layer — Dexie database
 *
 * Schema design:
 *  - conversations: metadata-only, no long bodies
 *  - messages: long content / modelResponses stored here, lazy-loaded
 *  - rssItems / rssFeeds: RSS pipeline tables
 *  - workflowTemplates: M5 Roundtable / Relay Chain user templates
 *
 * Migration path is versioned explicitly. Each .version() can only
 * modify stores/indexes; use .upgrade() for data transformations.
 *
 * Based on design-07-storage-data.md §3.
 */

import Dexie, { type EntityTable } from 'dexie';
import type {
  ConversationRecord,
  MessageRecord,
  RssFeedRecord,
  RssItemRecord,
  WorkflowTemplateRecord,
} from './types';

export class AiReaderDB extends Dexie {
  conversations!: EntityTable<ConversationRecord, 'id'>;
  messages!: EntityTable<MessageRecord, 'id'>;
  rssItems!: EntityTable<RssItemRecord, 'id'>;
  rssFeeds!: EntityTable<RssFeedRecord, 'id'>;
  workflowTemplates!: EntityTable<WorkflowTemplateRecord, 'id'>;

  constructor(name = 'AiReaderDB') {
    super(name);

    // Version 1: base schema
    this.version(1).stores({
      conversations: 'id, updatedAt, title, mode',
      messages: 'id, conversationId, parentId, createdAt',
      rssItems: 'id, feedId, pubDate, isRead, hash',
      rssFeeds: 'id, url, enabled, lastFetchedAt',
    });

    // Version 2: compound indexes for conversation-scoped queries
    this.version(2).stores({
      conversations: 'id, updatedAt, title, mode',
      messages: 'id, [conversationId+createdAt], parentId, createdAt',
      rssItems: 'id, [feedId+pubDate], isRead, hash',
      rssFeeds: 'id, url, enabled, lastFetchedAt',
    });

    // Version 3: pre-stage FTS index (populated in later phase)
    this.version(3).stores({
      conversations: 'id, updatedAt, title, mode',
      messages: 'id, [conversationId+createdAt], parentId, createdAt',
      rssItems: 'id, [feedId+pubDate], isRead, hash',
      rssFeeds: 'id, url, enabled, lastFetchedAt',
    });

    // Version 4: add workflowTemplates table
    this.version(4).stores({
      conversations: 'id, updatedAt, title, mode',
      messages: 'id, [conversationId+createdAt], parentId, createdAt',
      rssItems: 'id, [feedId+pubDate], isRead, hash',
      rssFeeds: 'id, url, enabled, lastFetchedAt',
      workflowTemplates: 'id, type, name, builtIn, updatedAt',
    });

    // Version 5: add isSummarized index for RSS
    this.version(5).stores({
      conversations: 'id, updatedAt, title, mode',
      messages: 'id, [conversationId+createdAt], parentId, createdAt',
      rssItems: 'id, [feedId+pubDate], isRead, hash, isSummarized',
      rssFeeds: 'id, url, enabled, lastFetchedAt',
      workflowTemplates: 'id, type, name, builtIn, updatedAt',
    });

    this.open().catch((err) => {
      console.error('[AiReaderDB] Failed to open database:', err);
      throw err;
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

let _db: AiReaderDB | null = null;

export function getDb(): AiReaderDB {
  if (!_db) {
    _db = new AiReaderDB();
  }
  return _db;
}

/** Reset for testing — creates a new instance with a unique name. */
export function resetDbForTests(name?: string): AiReaderDB {
  _db = new AiReaderDB(name ?? 'AiReaderDB-Test');
  return _db;
}

export { Dexie };
