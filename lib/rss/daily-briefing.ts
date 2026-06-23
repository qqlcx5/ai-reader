/**
 * M9 今日简报（Daily Briefing）
 *
 * generateBriefing(): 查询当天所有 RSS 文章，按 Feed 分组，
 * 生成 Markdown 格式简报，底部附统计信息。
 */

import { rssRepo } from '@/lib/db/repositories/rss.repo'

/**
 * 生成今日简报 Markdown。
 *
 * 格式：
 * ```
 * # 今日简报 — 2025-01-15
 *
 * ## 📰 The Verge（3 篇）
 * - **文章标题**：AI 摘要内容...
 *
 * ---
 * 共 X 篇新文章，来自 Y 个订阅源
 * ```
 */
export async function generateBriefing(): Promise<string> {
  const feeds = await rssRepo.listFeeds()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMidnight = today.getTime()

  const dateStr = today.toISOString().slice(0, 10)

  let totalArticles = 0
  let activeSources = 0
  let body = ''

  for (const feed of feeds) {
    const todayArticles = feed.articles.filter((a) => a.publishedAt >= todayMidnight)
    if (todayArticles.length === 0) continue

    activeSources++
    totalArticles += todayArticles.length

    body += `## 📰 ${feed.title}（${todayArticles.length} 篇）\n`
    for (const article of todayArticles) {
      const summary = article.summary || '（暂无摘要）'
      body += `- **${article.title}**：${summary}\n`
    }
    body += '\n'
  }

  if (totalArticles === 0) {
    return `# 今日简报 — ${dateStr}\n\n暂无今日新文章。`
  }

  return (
    `# 今日简报 — ${dateStr}\n\n` +
    body +
    `---\n共 ${totalArticles} 篇新文章，来自 ${activeSources} 个订阅源`
  )
}

/**
 * 检查今天是否已展示过简报。
 * 使用 chrome.storage.local 记录 lastBriefingDate。
 */
export async function checkShouldShowBriefing(): Promise<boolean> {
  try {
    const storage = typeof chrome !== 'undefined' ? chrome.storage?.local : undefined
    if (!storage) return true
    const result = await storage.get('rss_lastBriefingDate')
    const lastDate = result['rss_lastBriefingDate'] as string | undefined
    const today = new Date().toISOString().slice(0, 10)
    return lastDate !== today
  } catch {
    return true
  }
}

/**
 * 标记今天已展示简报。
 */
export async function markBriefingShown(): Promise<void> {
  try {
    const storage = typeof chrome !== 'undefined' ? chrome.storage?.local : undefined
    if (!storage) return
    const today = new Date().toISOString().slice(0, 10)
    await storage.set({ rss_lastBriefingDate: today })
  } catch {
    // best-effort
  }
}
