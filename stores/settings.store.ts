/**
 * M8 存储与数据层 — Settings Pinia Store
 *
 * 持久化：chrome.storage.local（$subscribe + setItem）
 * Popup 与 Side Panel 共享同一份 settings 状态。
 *
 * API Key 通过 key-store 单独管理（不写入此 store 序列化数据）。
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ProviderConfig, Settings } from '@/modules/storage/types'
import { defaultSettings } from '@/modules/storage/types'
import { saveKey, getKey, deleteKey, listConfiguredProviders } from '@/lib/db/key-store'

const STORAGE_KEY = 'readchat:settings'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...defaultSettings })

  // ─── 初始化：从 chrome.storage.local 恢复 ────────────────────────────────

  async function loadFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY)
      const raw = result[STORAGE_KEY]
      if (raw && typeof raw === 'string') {
        const parsed = JSON.parse(raw) as Partial<Settings>
        settings.value = { ...defaultSettings, ...parsed }
      }
    } catch (e) {
      console.warn('[SettingsStore] Failed to load from chrome.storage.local', e)
    }
  }

  /** 序列化写入 chrome.storage.local（排除 apiKey，API Key 走 key-store） */
  async function persistToStorage(): Promise<void> {
    const clone: Settings = JSON.parse(JSON.stringify(settings.value))
    // 序列化时清除 apiKey 字段，保证 Key 只在 key-store 里
    clone.providers = clone.providers.map((p) => ({ ...p, apiKey: '' }))
    await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(clone) })
  }

  // ─── 计算属性 ─────────────────────────────────────────────────────────────

  const enabledProviders = computed(() => settings.value.providers.filter((p) => p.enabled !== false))

  const hasAnyProvider = computed(() => settings.value.providers.length > 0)

  /** 向后兼容：若 providers 中存有明文 apiKey 字段则显示警告 */
  const apiKeyWarning = computed(() => {
    const hasPlaintext = settings.value.providers.some((p) => p.apiKey && p.storage !== 'encrypted')
    return hasPlaintext ? 'API Key 以明文存储在本地浏览器，请勿在公共/共享设备使用。' : ''
  })

  // ─── Provider 操作 ────────────────────────────────────────────────────────

  function setSettings(next: Partial<Settings>): void {
    settings.value = { ...settings.value, ...next }
    void persistToStorage()
  }

  function addProvider(provider: ProviderConfig): void {
    settings.value = {
      ...settings.value,
      providers: [...settings.value.providers, { ...provider, apiKey: '' }],
    }
    void persistToStorage()
  }

  function updateProvider(id: string, patch: Partial<ProviderConfig>): void {
    settings.value = {
      ...settings.value,
      providers: settings.value.providers.map((p) => (p.id === id ? { ...p, ...patch, apiKey: '' } : p)),
    }
    void persistToStorage()
  }

  function removeProvider(id: string): void {
    settings.value = {
      ...settings.value,
      providers: settings.value.providers.filter((p) => p.id !== id),
    }
    void persistToStorage()
    // 同步删除 key-store 中的 API Key
    void deleteKey(id)
  }

  // ─── API Key 代理（走 key-store，不落入 store 序列化） ───────────────────

  async function setApiKey(providerId: string, apiKey: string): Promise<void> {
    await saveKey(providerId, apiKey)
  }

  async function getApiKey(providerId: string): Promise<string | null> {
    return getKey(providerId)
  }

  async function removeApiKey(providerId: string): Promise<void> {
    await deleteKey(providerId)
  }

  async function getConfiguredProviderIds(): Promise<string[]> {
    return listConfiguredProviders()
  }

  // ─── 导出（不含 API Key） ─────────────────────────────────────────────────

  function exportSettings(): string {
    const clone: Settings = JSON.parse(JSON.stringify(settings.value))
    clone.providers = clone.providers.map((p) => ({ ...p, apiKey: '' }))
    return JSON.stringify(clone, null, 2)
  }

  function reset(): void {
    settings.value = { ...defaultSettings }
    void persistToStorage()
  }

  return {
    settings,
    enabledProviders,
    hasAnyProvider,
    apiKeyWarning,
    loadFromStorage,
    persistToStorage,
    setSettings,
    addProvider,
    updateProvider,
    removeProvider,
    setApiKey,
    getApiKey,
    removeApiKey,
    getConfiguredProviderIds,
    exportSettings,
    reset,
  }
})
