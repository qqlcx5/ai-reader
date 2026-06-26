/**
 * Pinia store for WebDAV sync.
 *
 * This module is the *UI-facing* façade over `webdav.service`.
 * It owns the reactive state (isSyncing / lastSyncAt / lastError
 * / lastDirection) and delegates the heavy lifting — fetch
 * negotiation, gzip, conflict handling, snapshot — to the
 * service layer.
 *
 * Persistence strategy:
 *   - `webdav_config` (settings table) — credentials, URL, …
 *   - The store hydrates from IndexedDB on `loadConfig()` and
 *     writes back through `saveConfig()`.
 *
 * Side effects:
 *   - The service is responsible for touching
 *     `lastSyncAt`; the store only mirrors the value in
 *     reactive state for the UI.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WebDAVConfig } from '@db/schema'
import {
  webdavService,
  loadWebDAVConfig,
  saveWebDAVConfig,
  type ProgressInfo,
  type WebDAVError,
} from '@core/persistence/webdav.service'

const SETTINGS_KEY = 'webdav_config'

function defaultConfig(): WebDAVConfig {
  return {
    enabled: false,
    url: '',
    username: '',
    password: '',
    remoteDir: 'AIReader_Backup',
    syncInterval: 30,
  }
}

export const useSyncStore = defineStore('sync', () => {
  /* ---------------- State ---------------- */
  const config = ref<WebDAVConfig>(defaultConfig())
  const isSyncing = ref(false)
  const lastSyncAt = ref<number | undefined>(undefined)
  const lastError = ref<string | null>(null)
  const lastDirection = ref<'up' | 'down' | null>(null)
  const lastResult = ref<'success' | 'error' | null>(null)
  const progress = ref<ProgressInfo | null>(null)
  const isLoading = ref(false)

  /* ---------------- Getters ---------------- */
  const isConfigured = computed(
    () => Boolean(config.value.enabled && config.value.url && config.value.username)
  )

  const lastSyncText = computed(() => {
    if (!lastSyncAt.value) return '从未同步'
    const diff = Date.now() - lastSyncAt.value
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    return `${days} 天前`
  })

  const canSync = computed(() => isConfigured.value && !isSyncing.value)

  /* ---------------- Actions ---------------- */

  async function loadConfig(): Promise<void> {
    isLoading.value = true
    try {
      const stored = await loadWebDAVConfig()
      if (stored) {
        config.value = stored
        lastSyncAt.value = stored.lastSyncAt
      }
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : '加载配置失败'
    } finally {
      isLoading.value = false
    }
  }

  async function saveConfig(updates: Partial<WebDAVConfig>): Promise<void> {
    config.value = { ...config.value, ...updates }
    await saveWebDAVConfig(config.value)
  }

  async function testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      // Always test the *current* form in memory, even if it
      // hasn't been persisted yet, so the Options page's
      // "Test connection" button can validate the in-flight
      // values.
      const result = await webdavService.testConnectionWith(config.value)
      return result.ok
        ? { ok: true }
        : { ok: false, error: result.error ?? '连接失败' }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : '连接失败' }
    }
  }

  function emitProgress(info: ProgressInfo) {
    progress.value = info
    if (info.error) {
      lastError.value = info.error
    }
  }

  async function syncUp(): Promise<{ ok: boolean; error?: string }> {
    if (!isConfigured.value) {
      return { ok: false, error: '请先配置 WebDAV 并启用同步' }
    }
    isSyncing.value = true
    lastError.value = null
    lastDirection.value = 'up'
    try {
      const result = await webdavService.upload({ onProgress: emitProgress })
      lastSyncAt.value = result.uploadedAt
      lastResult.value = 'success'
      return { ok: true }
    } catch (err) {
      lastError.value = formatError(err)
      lastResult.value = 'error'
      return { ok: false, error: lastError.value }
    } finally {
      isSyncing.value = false
    }
  }

  async function syncDown(opts: { force?: boolean; confirmReplace?: () => Promise<boolean> } = {}): Promise<{ ok: boolean; error?: string }> {
    if (!isConfigured.value) {
      return { ok: false, error: '请先配置 WebDAV 并启用同步' }
    }
    isSyncing.value = true
    lastError.value = null
    lastDirection.value = 'down'
    try {
      const result = await webdavService.download({
        force: opts.force,
        conflict: opts.confirmReplace
          ? { confirmReplace: opts.confirmReplace, remoteUpdatedAt: 0, localUpdatedAt: 0 }
          : undefined,
        onProgress: emitProgress,
      })
      lastSyncAt.value = result.remoteUpdatedAt
      lastResult.value = 'success'
      return { ok: true }
    } catch (err) {
      lastError.value = formatError(err)
      lastResult.value = 'error'
      return { ok: false, error: lastError.value }
    } finally {
      isSyncing.value = false
    }
  }

  function clearProgress() {
    progress.value = null
  }

  return {
    // state
    config,
    isSyncing,
    lastSyncAt,
    lastError,
    lastDirection,
    lastResult,
    progress,
    isLoading,
    // getters
    isConfigured,
    lastSyncText,
    canSync,
    // actions
    loadConfig,
    saveConfig,
    testConnection,
    syncUp,
    syncDown,
    clearProgress,
  }
})

function formatError(err: unknown): string {
  if (!err) return '未知错误'
  if (typeof err === 'string') return err
  if (err instanceof Error) {
    // WebDAVError and friends carry extra context we want to
    // surface verbatim.
    return err.message
  }
  return String(err)
}

// Re-export for callers that need direct access.
export type { WebDAVError, ProgressInfo }
