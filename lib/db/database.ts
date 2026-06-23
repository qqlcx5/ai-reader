/**
 * M8 存储与数据层 — Dexie 数据库初始化
 *
 * 主副表读写分离：
 *  - Conversations: 元数据（查询 < 5ms，严禁存长文本）
 *  - Messages:      完整内容（仅按 ID 懒加载）
 *  - Highlights:    页面高亮选区
 *  - RSSFeeds:      RSS 订阅源与文章（articles 内联）
 *  - Templates:     提示词模板
 *  - l2Cache:       L2 提取结果缓存（TTL 24h）
 *  - l3Cache:       L3 API 响应缓存（Content Hash）
 *
 * 升级策略：每个版本通过 .version(n).stores() 声明，数据迁移用 .upgrade()。
 */

import Dexie, { type EntityTable } from 'dexie'
import type {
  ConversationRecord,
  MessageRecord,
  HighlightRecord,
  RSSFeedRecord,
  TemplateRecord,
  L2CacheEntry,
  L3CacheEntry,
} from './types'

export class ReadChatDB extends Dexie {
  conversations!: EntityTable<ConversationRecord, 'id'>
  messages!: EntityTable<MessageRecord, 'id'>
  highlights!: EntityTable<HighlightRecord, 'id'>
  rssFeeds!: EntityTable<RSSFeedRecord, 'id'>
  templates!: EntityTable<TemplateRecord, 'id'>
  l2Cache!: EntityTable<L2CacheEntry, 'id'>
  l3Cache!: EntityTable<L3CacheEntry, 'id'>

  constructor(name = 'ReadChatClipper') {
    super(name)

    // v1: 初始 schema
    this.version(1).stores({
      conversations: 'id, url, domain, updatedAt, createdAt',
      messages: 'id',
      highlights: 'id, pageId, domain',
      rssFeeds: 'id, url',
      templates: 'id, createdAt',
    })

    // v2: 加入缓存表（L2 / L3）及 highlights 时间索引
    this.version(2).stores({
      conversations: 'id, url, domain, updatedAt, createdAt',
      messages: 'id',
      highlights: 'id, pageId, domain, createdAt',
      rssFeeds: 'id, url',
      templates: 'id, createdAt',
      l2Cache: 'id, pageId, expiresAt',
      l3Cache: 'id, hash, createdAt',
    })

    // v3（预留）: 未来扩展占位，upgrade() 用于数据迁移
    this.version(3)
      .stores({
        conversations: 'id, url, domain, updatedAt, createdAt',
        messages: 'id',
        highlights: 'id, pageId, domain, createdAt',
        rssFeeds: 'id, url',
        templates: 'id, createdAt',
        l2Cache: 'id, pageId, expiresAt',
        l3Cache: 'id, hash, createdAt',
      })
      .upgrade((_tx) => {
        // 数据迁移逻辑在此处添加
      })

    this.open().catch((err) => {
      console.error('[ReadChatDB] Failed to open database', err)
      throw err
    })
  }
}

let _db: ReadChatDB | null = null

/** 获取数据库单例（所有 Repository 通过此函数访问） */
export function getDb(): ReadChatDB {
  if (!_db) {
    _db = new ReadChatDB()
  }
  return _db
}

/** 仅用于单元测试：重置为隔离实例 */
export function resetDbForTests(name?: string): ReadChatDB {
  _db = new ReadChatDB(name ?? 'ReadChatClipper-Test')
  return _db
}

export { Dexie }
