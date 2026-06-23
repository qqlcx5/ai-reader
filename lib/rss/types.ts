/**
 * M9 RSS 自动化流水线 — 核心运行时类型
 *
 * RawArticle / RawFeedData: fetcher 解析后的中间结构
 * （持久化类型见 lib/db/types.ts RSSFeedRecord / RSSArticleRecord）
 */

/** 从 RSS/Atom 源解析出的单篇文章（持久化之前的中间格式） */
export interface RawArticle {
  title: string
  link: string
  /** HTML 或纯文本描述，用于 AI 摘要生成 */
  description: string
  /** Unix 时间戳（毫秒） */
  pubDate: number
  author?: string
}

/** fetchFeed() 的返回值 */
export interface RawFeedData {
  feedTitle: string
  feedUrl: string
  items: RawArticle[]
}
