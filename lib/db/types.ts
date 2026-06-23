/**
 * M8 存储与数据层 — 核心类型定义
 *
 * 主表 Conversations（元数据，查询 < 5ms）
 * 副表 Messages（完整数据，仅点击时懒加载）
 * 高亮选区表 Highlights
 * RSS 订阅源表 RSSFeeds
 * 提示词模板表 Templates
 * 缓存条目（L2 / L3）
 */

// ─── 对话主表（元数据） ──────────────────────────────────────────────────────

export interface ConversationRecord {
  /** SHA-256(normalizeUrl) */
  id: string
  url: string
  title: string
  favicon: string
  domain: string
  createdAt: number
  updatedAt: number
  wordCount: number
  engine: 'readability' | 'defuddle' | 'fallback'
  messageCount: number
  models: string[]
}

// ─── 消息副表（完整内容，懒加载） ────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp: number
  model?: string
  provider?: string
  /** Time-to-first-token (ms) */
  ttft?: number
  /** Tokens per second */
  tps?: number
  /** 估算费用 (USD) */
  cost?: number
  /** L3 缓存命中时为 true */
  cached?: boolean
}

export interface PageMetadata {
  author?: string
  published?: string
  description?: string
  ogImage?: string
  schemaType?: string
  ogTitle?: string
  ogDescription?: string
}

export interface MessageRecord {
  id: string
  rawText: string
  metadata: PageMetadata
  chatHistory: ChatMessage[]
}

// ─── 高亮选区表 ──────────────────────────────────────────────────────────────

export type HighlightStyle = 'mark' | 'underline' | 'blur' | 'wave' | 'bold' | 'italic' | 'border'

export interface HighlightRecord {
  id: string
  pageId: string
  domain: string
  selector: string
  text: string
  style: HighlightStyle
  createdAt: number
}

// ─── RSS 订阅源表 ─────────────────────────────────────────────────────────────

export interface RSSArticleRecord {
  id: string
  link: string
  title: string
  summary: string
  publishedAt: number
  isRead: boolean
}

export interface RSSFeedRecord {
  id: string
  url: string
  title: string
  fetchInterval: number
  lastFetched: number
  articles: RSSArticleRecord[]
}

// ─── 提示词模板表 ─────────────────────────────────────────────────────────────

export interface TemplateRecord {
  id: string
  name: string
  icon: string
  prompt: string
  urlPattern?: string
  schemaType?: string
  filters?: string[]
  createdAt: number
}

// ─── 三级缓存条目类型 ─────────────────────────────────────────────────────────

/** L2 持久化缓存条目（ExtractionResult + TTL） */
export interface L2CacheEntry {
  id: string
  /** pageId (URL hash) */
  pageId: string
  data: ExtractionResult
  createdAt: number
  expiresAt: number
}

/** L3 API 响应缓存条目（Content Hash） */
export interface L3CacheEntry {
  id: string
  /** SHA-256(pageId + prompt + model) */
  hash: string
  responseText: string
  createdAt: number
}

// ─── 提取结果（上下文锚定） ──────────────────────────────────────────────────

/** 上下文使用模式（与渲染层协商） */
export type ContextMode = 'summary' | 'full' | 'selected' | 'relay'

export interface ExtractionResult {
  pageId: string
  url: string
  title: string
  favicon?: string
  domain: string
  rawText: string
  markdownText?: string
  /** 完整正文（与 rawText 等价，保留向后兼容） */
  fullText?: string
  /** 摘要/导语（首段或 description），用于列表预览 */
  excerpt?: string
  metadata: PageMetadata
  wordCount: number
  engine: 'readability' | 'defuddle' | 'fallback'
  /** 上下文注入模式（向后兼容，store 中也有独立 mode ref） */
  mode?: ContextMode
  extractedAt: number
}

// ─── 列表查询选项 ─────────────────────────────────────────────────────────────

export interface ConversationListOptions {
  sortBy: 'updatedAt' | 'domain'
  limit: number
  offset: number
}
