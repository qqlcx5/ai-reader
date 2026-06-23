/**
 * M9 哈希去重
 *
 * computeArticleId: SHA-256(article.link) → 64 位 hex 字符串
 * filterNewArticles: 过滤已存在文章，仅返回新文章
 */

import type { RawArticle } from './types'

/**
 * 计算文章唯一 ID：SHA-256(article.link) → hex
 * 与 RSSArticleRecord.id 保持一致。
 */
export async function computeArticleId(article: { link: string }): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(article.link)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 过滤新文章：仅返回 ID 不在 existing Set 中的文章。
 *
 * @param fetched  从 RSS 源抓取的原始文章列表
 * @param existing 已存储文章 ID 的 Set（来自 RSSFeedRecord.articles）
 */
export async function filterNewArticles(
  fetched: RawArticle[],
  existing: Set<string>,
): Promise<RawArticle[]> {
  const results: RawArticle[] = []
  for (const article of fetched) {
    const id = await computeArticleId(article)
    if (!existing.has(id)) {
      results.push(article)
    }
  }
  return results
}
