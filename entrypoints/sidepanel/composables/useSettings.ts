import { useSettingsStore } from '@/stores/settings'
import type { AppSettings } from '@/shared/domain'

export function useSettings() {
  const store = useSettingsStore()

  async function loadSettings() {
    await store.load()
  }

  async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    await store.update({ [key]: value })
  }

  function resetToDefaults() {
    store.reset()
    store.save()
  }

  return { settings: store.settings, loadSettings, updateSetting, resetToDefaults }
}
