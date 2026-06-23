import Dexie, { type EntityTable } from 'dexie';
import {
  type ConversationRecord,
  type MessageRecord,
  type RssFeedRecord,
  type RssItemRecord,
  type WorkflowTemplateRecord,
  type PageRecord,
} from './types';

/**
 * M7 Storage & Data Layer — Dexie database
 *
 * Schema design:
 *  - conversations: metadata-only, no long bodies
 *  - messages: long content / modelResponses stored here, lazy-loaded
 *  - rssItems / rssFeeds: RSS pipeline tables
 *  - workflowTemplates: M5 Roundtable / Relay Chain user templates
 *
 * Workflow sessions themselves reuse the conversations table with
 * `mode = 'roundtable' | 'relay'`. Only the reusable templates need a
 * separate table.
 *
 * Migration path is versioned explicitly. Each .version() can only modify
 * stores/indexes; use .upgrade() for data transformations.
 */
export class AiReaderDB extends Dexie {
  conversations!: EntityTable<ConversationRecord, 'id'>;
  messages!: EntityTable<MessageRecord, 'id'>;
  rssItems!: EntityTable<RssItemRecord, 'id'>;
  rssFeeds!: EntityTable<RssFeedRecord, 'id'>;
  workflowTemplates!: EntityTable<WorkflowTemplateRecord, 'id'>;
  pages!: EntityTable<PageRecord, 'id'>;

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

    // Version 4 (M5): add workflowTemplates table.
    // We also drop the FTS placeholder that was reserved in v3 but never
    // populated, since the worker-based search path is the active one.
    this.version(4).stores({
      conversations: 'id, updatedAt, title, mode',
      messages: 'id, [conversationId+createdAt], parentId, createdAt',
      rssItems: 'id, [feedId+pubDate], isRead, hash',
      rssFeeds: 'id, url, enabled, lastFetchedAt',
      workflowTemplates: 'id, type, name, builtIn, updatedAt',
    });

    // Version 5 (M8): add indexes for RSS AI summary filtering.
    // Schema doesn't change (Dexie handles new fields transparently),
    // but we add an index on `isSummarized` to support filtered queries.
    this.version(5).stores({
      conversations: 'id, updatedAt, title, mode',
      messages: 'id, [conversationId+createdAt], parentId, createdAt',
      rssItems: 'id, [feedId+pubDate], isRead, hash, isSummarized',
      rssFeeds: 'id, url, enabled, lastFetchedAt',
      workflowTemplates: 'id, type, name, builtIn, updatedAt',
    });

    // Version 6: add URL-keyed pages table for per-page conversation binding.
    this.version(6).stores({
      conversations: 'id, updatedAt, title, mode',
      messages: 'id, [conversationId+createdAt], parentId, createdAt',
      rssItems: 'id, [feedId+pubDate], isRead, hash, isSummarized',
      rssFeeds: 'id, url, enabled, lastFetchedAt',
      workflowTemplates: 'id, type, name, builtIn, updatedAt',
      pages: 'id, url, conversationId, timestamp',
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
