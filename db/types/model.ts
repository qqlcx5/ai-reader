/**
 * Model, sync and global app settings.
 *
 * `ModelProviderConfig` is the only model record we persist at the
 * moment; we deliberately keep the surface small so adding new
 * OpenAI-compatible providers is just a matter of changing `baseUrl`
 * + `model`.
 */

export interface ModelProviderConfig {
  id: string
  name: string
  /** Always `openai-compatible` for v1. */
  provider: 'openai-compatible'
  enabled: boolean
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  isDefault?: boolean
  createdAt: number
  updatedAt: number
}

export interface WebDAVConfig {
  enabled: boolean
  url: string
  username: string
  password: string
  remoteDir: string
  /** Auto sync interval in minutes (0 = manual only). */
  syncInterval: number
  /** Last successful sync timestamp (ms epoch). */
  lastSyncAt?: number
}

export interface SyncConfig {
  webdav: WebDAVConfig
  autoSync: boolean
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto'
  language: string
  defaultModelId?: string
  autoCapture: boolean
  showFloatingButton: boolean
  floatingButtonPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  sidePanelWidth?: number
  defaultSystemPrompt: string
  enableSearch: boolean
  enableTimeline: boolean
}
