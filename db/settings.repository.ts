// ============================================================
// PageMind — Settings Repository (chrome.storage.sync)
// ============================================================

import type { AppSettings } from '@/domain'
import { DEFAULT_SETTINGS } from '@/domain'

const STORAGE_KEY = 'pagemind_settings'

/**
 * 读取设置，不存在时返回 DEFAULT_SETTINGS
 */
export async function getSettings(): Promise<AppSettings> {
  const result = await browser.storage.sync.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as AppSettings) ?? { ...DEFAULT_SETTINGS }
}

/**
 * merge 更新设置后写回
 */
export async function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings()
  const updated = { ...current, ...partial }
  await browser.storage.sync.set({ [STORAGE_KEY]: updated })
  return updated
}

/**
 * 恢复全部默认设置
 */
export async function resetSettings(): Promise<AppSettings> {
  await browser.storage.sync.set({ [STORAGE_KEY]: { ...DEFAULT_SETTINGS } })
  return { ...DEFAULT_SETTINGS }
}
