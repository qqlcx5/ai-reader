/**
 * Repository for `ModelProviderConfig` records.
 *
 * Model configs aren't a Dexie table in v1 (they live in
 * `chrome.storage.local` via Pinia persistedstate). This module
 * provides a small adapter so that the rest of the codebase can
 * depend on a stable CRUD interface and we can swap the
 * persistence backend later without changing call sites.
 */

import { settingsRepository } from './settings.repository'
import { DEFAULT_MODELS } from '@shared/constants'
import type { ModelProviderConfig } from '@db/schema'

const KEY = 'model_providers'

const now = () => Date.now()

function isConfig(value: unknown): value is ModelProviderConfig {
  return (
    !!value &&
    typeof value === 'object' &&
    'id' in (value as Record<string, unknown>) &&
    'provider' in (value as Record<string, unknown>)
  )
}

export const modelRepository = {
  async list(): Promise<ModelProviderConfig[]> {
    const stored = await settingsRepository.getJSON<unknown[]>(KEY, [])
    if (!Array.isArray(stored)) return []
    return stored.filter(isConfig)
  },

  async get(id: string): Promise<ModelProviderConfig | undefined> {
    const all = await this.list()
    return all.find((m) => m.id === id)
  },

  async listEnabled(): Promise<ModelProviderConfig[]> {
    const all = await this.list()
    return all.filter((m) => m.enabled)
  },

  async getDefault(): Promise<ModelProviderConfig | undefined> {
    const all = await this.list()
    return (
      all.find((m) => m.isDefault) ||
      all.find((m) => m.enabled) ||
      all[0]
    )
  },

  async upsert(config: ModelProviderConfig): Promise<void> {
    const all = await this.list()
    const index = all.findIndex((m) => m.id === config.id)
    const ts = now()
    const record: ModelProviderConfig = {
      ...config,
      createdAt: config.createdAt || ts,
      updatedAt: ts,
    }
    if (index >= 0) {
      all[index] = record
    } else {
      all.push(record)
    }
    // If this is the new default, unset the previous one.
    if (record.isDefault) {
      for (const m of all) {
        if (m.id !== record.id) m.isDefault = false
      }
    }
    await settingsRepository.set(KEY, all)
  },

  async delete(id: string): Promise<void> {
    const all = await this.list()
    await settingsRepository.set(KEY, all.filter((m) => m.id !== id))
  },

  async setDefault(id: string): Promise<void> {
    const all = await this.list()
    for (const m of all) m.isDefault = m.id === id
    await settingsRepository.set(KEY, all)
  },

  async bulkPut(configs: ModelProviderConfig[]): Promise<void> {
    const existing = await this.list()
    const map = new Map(existing.map((m) => [m.id, m]))
    for (const c of configs) map.set(c.id, c)
    await settingsRepository.set(KEY, Array.from(map.values()))
  },

  async clear(): Promise<void> {
    await settingsRepository.set(KEY, [])
  },

  /** Seed default models on first run. */
  async seedDefaults(): Promise<void> {
    const existing = await this.list()
    if (existing.length > 0) return
    const ts = now()
    await settingsRepository.set(
      KEY,
      DEFAULT_MODELS.map((m, i) => ({
        ...m,
        createdAt: ts,
        updatedAt: ts,
        isDefault: i === 0,
      }))
    )
  },
}
