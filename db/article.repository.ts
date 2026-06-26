import { db } from './index'
import type { Article } from '@/domain'

// ============================================================
// PageMind — Article Repository (IndexedDB via Dexie)
// ============================================================

/**
 * 保存文章：同 URL 覆盖更新，保留 createdAt，更新 updatedAt
 */
export async function saveArticle(article: Article): Promise<Article> {
  const now = new Date().toISOString()
  const existing = await getArticleByUrl(article.url)

  if (existing) {
    // 覆盖更新，保留原 createdAt
    const updated: Article = {
      ...article,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
    }
    await db.articles.put(updated)
    return updated
  }

  const newArticle: Article = {
    ...article,
    id: article.id || crypto.randomUUID(),
    createdAt: article.createdAt || now,
    updatedAt: now,
  }
  await db.articles.put(newArticle)
  return newArticle
}

/**
 * 按主键查询文章
 */
export async function getArticle(id: string): Promise<Article | undefined> {
  return db.articles.get(id)
}

/**
 * 按 URL 查询文章（利用 url 索引）
 */
export async function getArticleByUrl(url: string): Promise<Article | undefined> {
  return db.articles.where('url').equals(url).first()
}

/**
 * 按 createdAt 降序列出所有文章
 */
export async function listArticles(): Promise<Article[]> {
  return db.articles.orderBy('createdAt').reverse().toArray()
}

/**
 * Phase 1 搜索：内存 includes() 过滤 title + siteName + author + excerpt
 */
export async function searchArticles(keyword: string): Promise<Article[]> {
  const lower = keyword.toLowerCase()
  const all = await db.articles.toArray()
  return all.filter((a) => {
    const fields = [a.title, a.siteName ?? '', a.author ?? '', a.excerpt ?? '']
    return fields.some((f) => f.toLowerCase().includes(lower))
  })
}

/**
 * 按主键删除文章
 */
export async function deleteArticle(id: string): Promise<void> {
  await db.articles.delete(id)
}

/**
 * 获取最近 N 篇文章（按 createdAt 降序）
 */
export async function getRecentArticles(limit = 3): Promise<Article[]> {
  return db.articles.orderBy('createdAt').reverse().limit(limit).toArray()
}
