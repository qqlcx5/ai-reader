/**
 * Settings service.
 *
 * Thin, typed wrapper around `settingsRepository` for the
 * top-level `AppSettings` blob. Centralises the storage key,
 * the default object and the merge semantics so call sites
 * never have to remember them.
 *
 * Storage location: `settings` table (Dexie / IndexedDB),
 * under key `app_settings`. We deliberately reuse the same
 * key the legacy `modelStore` writes — that store still
 * hydrates from here, so we want one source of truth.
 */

import { settingsRepository } from '@core/models/settings.repository'
import { DEFAULT_SYSTEM_PROMPT } from '@shared/constants'
import type { AppSettings } from '@db/schema'

const SETTINGS_KEY = 'app_settings'

/**
 * Canonical default settings. Every consumer of `AppSettings`
 * should treat this as the merge base; partial updates are
 * shallow-merged on top of it.
 */
export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'auto',
  language: 'zh-CN',
  autoCapture: false,
  showFloatingButton: true,
  floatingButtonPosition: 'bottom-right',
  sidePanelWidth: 400,
  defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
  enableSearch: true,
  enableTimeline: true,
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Return a deep-merge of the defaults and the persisted value.
 * Unknown keys are dropped (so a corrupted blob can't pollute
 * the in-memory state), and nested objects (none at the moment,
 * but the structure is ready for them) are merged recursively.
 */
function mergeWithDefaults(stored: unknown): AppSettings {
  if (!isPlainObject(stored)) return { ...DEFAULT_APP_SETTINGS }
  const merged: Record<string, unknown> = { ...DEFAULT_APP_SETTINGS }
  for (const key of Object.keys(DEFAULT_APP_SETTINGS)) {
    if (!(key in stored)) continue
    const v = (stored as Record<string, unknown>)[key]
    const d = (DEFAULT_APP_SETTINGS as Record<string, unknown>)[key]
    if (isPlainObject(v) && isPlainObject(d)) {
      merged[key] = { ...d, ...v }
    } else {
      merged[key] = v
    }
  }
  return merged as AppSettings
}

export const settingsService = {
  /** Read the persisted AppSettings, falling back to defaults. */
  async get(): Promise<AppSettings> {
    const stored = await settingsRepository.getJSON<unknown>(SETTINGS_KEY, DEFAULT_APP_SETTINGS)
    return mergeWithDefaults(stored)
  },

  /**
   * Shallow-merge `updates` into the current settings, persist
   * and return the resulting AppSettings.
   */
  async update(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.get()
    const next: AppSettings = { ...current, ...updates }
    await settingsRepository.set(SETTINGS_KEY, next)
    return next
  },

  /** Reset to the defaults; return the resulting AppSettings. */
  async reset(): Promise<AppSettings> {
    const fresh: AppSettings = { ...DEFAULT_APP_SETTINGS }
    await settingsRepository.set(SETTINGS_KEY, fresh)
    return fresh
  },

  /** Exposed for tests / advanced callers. */
  DEFAULT: DEFAULT_APP_SETTINGS,
}

export type { AppSettings }
