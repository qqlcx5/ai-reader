/**
 * Repository for the `settings` table.
 *
 * Settings are stored as a generic `(key, value, updatedAt)` tuple
 * rather than typed columns. This keeps schema changes cheap.
 * For strongly-typed config (e.g. `AppSettings`, `WebDAVConfig`)
 * callers can use the `getJSON<T>(key, fallback)` helper.
 */

import { db } from '@db/dexie'
import type { SettingsEntry } from '@db/schema'

const now = () => Date.now()

export const settingsRepository = {
  async get<T = unknown>(key: string): Promise<SettingsEntry<T> | undefined> {
    return db.settings.get(key)
  },

  async getJSON<T = unknown>(key: string, fallback: T): Promise<T> {
    const entry = await db.settings.get<T>(key)
    return entry ? entry.value : fallback
  },

  async set<T = unknown>(key: string, value: T): Promise<void> {
    await db.settings.put({
      key,
      value,
      updatedAt: now(),
    })
  },

  async delete(key: string): Promise<void> {
    await db.settings.delete(key)
  },

  async list(): Promise<SettingsEntry[]> {
    return db.settings.toArray()
  },

  async bulkPut(entries: SettingsEntry[]): Promise<void> {
    await db.settings.bulkPut(entries)
  },

  async clear(): Promise<void> {
    await db.settings.clear()
  },
}
