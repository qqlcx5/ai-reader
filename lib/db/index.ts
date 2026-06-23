/**
 * M8 存储与数据层 — lib/db 公共导出
 */

// 核心类型
export type {
  ConversationRecord,
  MessageRecord,
  ChatMessage,
  PageMetadata,
  HighlightRecord,
  HighlightStyle,
  RSSFeedRecord,
  RSSArticleRecord,
  TemplateRecord,
  ExtractionResult,
  ConversationListOptions,
  L2CacheEntry,
  L3CacheEntry,
} from './types'

// 数据库实例
export { getDb, resetDbForTests, ReadChatDB } from './database'

// Repositories
export { conversationRepo, ConversationRepository } from './repositories/conversation.repo'
export { messageRepo, MessageRepository } from './repositories/message.repo'
export { highlightRepo, HighlightRepository } from './repositories/highlight.repo'
export { templateRepo, TemplateRepository } from './repositories/template.repo'
export { rssRepo, RSSRepository } from './repositories/rss.repo'

// 缓存层
export { L1Cache, extractionL1Cache, apiResponseL1Cache } from './cache/l1-cache'
export { L2Cache, l2Cache } from './cache/l2-cache'
export { L3Cache, l3Cache, getCachedApiResponse, setCachedApiResponse } from './cache/l3-cache'

// Key Store
export { saveKey, getKey, deleteKey, listConfiguredProviders, hasKey } from './key-store'
