import { db } from '../index'
import type { AppSettings } from '../../types/settings'

export const SettingsRepository = {
  async get(): Promise<AppSettings | undefined> {
    return db.settings.get('app-settings')
  },

  async save(settings: AppSettings): Promise<void> {
    await db.settings.put(settings)
  },
}
