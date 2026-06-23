/**
 * M9 扩展 Badge 未读计数
 *
 * updateBadge(): 查询未读文章数，更新扩展图标 Badge
 * - 有未读：显示数量，背景色 obsidian-primary #5b60e5
 * - 全已读：清空 Badge
 */

import { rssRepo } from '@/lib/db/repositories/rss.repo'

interface ActionApi {
  setBadgeText(details: { text: string }): Promise<void> | void
  setBadgeBackgroundColor(details: { color: string }): Promise<void> | void
}

function getActionApi(): ActionApi | null {
  const candidates: unknown[] = []
  if (typeof browser !== 'undefined') candidates.push(browser)
  if (typeof chrome !== 'undefined') candidates.push(chrome)
  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue
    const action = (c as Record<string, unknown>).action as Partial<ActionApi> | undefined
    if (action && typeof action.setBadgeText === 'function') {
      return action as ActionApi
    }
  }
  return null
}

/**
 * 更新扩展图标 Badge 未读数。
 * 在每次 Alarm 完成后 + 用户标记已读后调用。
 */
export async function updateBadge(): Promise<void> {
  const count = await rssRepo.getUnreadCount()

  try {
    const action = getActionApi()
    if (action) {
      const text = count > 0 ? String(count) : ''
      await action.setBadgeText({ text })
      await action.setBadgeBackgroundColor({ color: '#5b60e5' })
    }
  } catch {
    // Badge API 不可用时静默失败（内容脚本、测试环境等）
  }
}
