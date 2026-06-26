/**
 * Pinia store for model configuration.
 *
 * Persists to IndexedDB through the `modelRepository` /
 * `settingsRepository` pair, which means changes survive
 * extension restarts. The store also exposes the chat adapter
 * functions (`chat`, `ping`) for the side panel and any other
 * surface that needs to talk to the models.
 */

import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import type { ModelProviderConfig, AppSettings } from '@db/schema'
import { modelRepository } from './model.repository'
import { settingsRepository } from './settings.repository'
import { DEFAULT_SYSTEM_PROMPT } from '@shared/constants'
import { DEFAULT_APP_SETTINGS } from '@core/persistence/settings.service'
import { chat, ping } from './openai-compat.adapter'
import type { ChatMessage as AdapterChatMessage, PingResult, Message, StreamDelta } from './types'

export type { ModelProviderConfig } from '@db/schema'

/** A single chat message surfaced to the UI. */
export interface UIChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  isStreaming?: boolean
  error?: string
  model?: string
}

/** Status of a connectivity probe. */
export type ConnectionStatus = 'idle' | 'testing' | 'ok' | 'failed'

const SETTINGS_KEY = 'app_settings'
const PROMPT_KEY = 'model_prompts'

/**
 * Build a clean default settings object. Kept in a function so we
 * never accidentally share the same reference between consumers.
 */
function defaultSettings(): AppSettings {
  // Reuse the persistence-layer defaults so the model store
  // and the settings service can't drift apart.
  return { ...DEFAULT_APP_SETTINGS }
}

export const useModelStore = defineStore('model', () => {
  // ====================== State ======================
  const models = ref<ModelProviderConfig[]>([])
  const settings = ref<AppSettings>(defaultSettings())
  /** modelId -> per-model system prompt override. */
  const perModelPrompts = ref<Record<string, string>>({})

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Connection probe state, keyed by model id.
  const connectionStatus = ref<Record<string, ConnectionStatus>>({})
  const connectionLatency = ref<Record<string, number | undefined>>({})
  const connectionError = ref<Record<string, string | undefined>>({})

  // Cheap ref to the adapter functions so consumers can grab them
  // off the store. `shallowRef` avoids reactivity overhead.
  const adapter = shallowRef({ chat, ping })

  // ====================== Getters ======================
  const enabledModels = computed(() => models.value.filter((m) => m.enabled))
  const defaultModel = computed(
    () => models.value.find((m) => m.isDefault) || enabledModels.value[0]
  )

  const getModelById = computed(() => (id: string) => models.value.find((m) => m.id === id))

  const isReady = computed(() => !isLoading.value)

  // ====================== Actions: load/save ======================
  async function loadAll() {
    isLoading.value = true
    try {
      const [list, persistedSettings, persistedPrompts] = await Promise.all([
        modelRepository.list(),
        settingsRepository.getJSON<AppSettings>(SETTINGS_KEY, defaultSettings()),
        settingsRepository.getJSON<Record<string, string>>(PROMPT_KEY, {}),
      ])
      models.value = list
      settings.value = { ...defaultSettings(), ...persistedSettings }
      perModelPrompts.value = persistedPrompts ?? {}
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load models'
      console.error('[modelStore] loadAll failed:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Convenience wrapper that callers (e.g. the options page)
   * can use to do an initial data load. Internally identical to
   * `loadAll()`.
   */
  async function loadSettings() {
    return loadAll()
  }

  async function saveSettings(updates: Partial<AppSettings>): Promise<void> {
    try {
      settings.value = { ...settings.value, ...updates }
      await settingsRepository.set(SETTINGS_KEY, settings.value)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save settings'
      throw err
    }
  }

  // ====================== Actions: models ======================
  async function addModel(model: Omit<ModelProviderConfig, 'createdAt' | 'updatedAt'>): Promise<void> {
    const ts = Date.now()
    const record: ModelProviderConfig = { ...model, createdAt: ts, updatedAt: ts }
    await modelRepository.upsert(record)
    await reloadModels()
  }

  async function updateModel(id: string, updates: Partial<ModelProviderConfig>): Promise<void> {
    const existing = await modelRepository.get(id)
    if (!existing) throw new Error(`Model ${id} not found`)
    await modelRepository.upsert({ ...existing, ...updates, id: existing.id })
    await reloadModels()
  }

  async function deleteModel(id: string): Promise<void> {
    await modelRepository.delete(id)
    // Clean up per-model prompt override.
    if (perModelPrompts.value[id] !== undefined) {
      const next = { ...perModelPrompts.value }
      delete next[id]
      perModelPrompts.value = next
      await settingsRepository.set(PROMPT_KEY, next)
    }
    await reloadModels()
  }

  async function setDefaultModel(id: string): Promise<void> {
    await modelRepository.setDefault(id)
    await reloadModels()
  }

  async function toggleEnabled(id: string, enabled: boolean): Promise<void> {
    await updateModel(id, { enabled })
  }

  async function reloadModels(): Promise<void> {
    models.value = await modelRepository.list()
  }

  /** First-run seeding — no-op if anything is already configured. */
  async function seedDefaults(): Promise<void> {
    await modelRepository.seedDefaults()
    await reloadModels()
  }

  // ====================== Actions: prompts ======================
  function resolveSystemPrompt(modelId?: string): string {
    if (modelId && perModelPrompts.value[modelId]) {
      return perModelPrompts.value[modelId]
    }
    return settings.value.defaultSystemPrompt || DEFAULT_SYSTEM_PROMPT
  }

  function getModelPrompt(modelId: string): string {
    return perModelPrompts.value[modelId] ?? ''
  }

  async function setModelPrompt(modelId: string, prompt: string): Promise<void> {
    const next = { ...perModelPrompts.value, [modelId]: prompt }
    perModelPrompts.value = next
    await settingsRepository.set(PROMPT_KEY, next)
  }

  async function clearModelPrompt(modelId: string): Promise<void> {
    if (perModelPrompts.value[modelId] === undefined) return
    const next = { ...perModelPrompts.value }
    delete next[modelId]
    perModelPrompts.value = next
    await settingsRepository.set(PROMPT_KEY, next)
  }

  async function setDefaultSystemPrompt(prompt: string): Promise<void> {
    await saveSettings({ defaultSystemPrompt: prompt })
  }

  // ====================== Actions: connectivity ======================
  /**
   * Run a connectivity check against a model and store the result.
   * Returns the underlying `PingResult` so callers can show
   * detailed feedback if they want.
   */
  async function testConnection(model: ModelProviderConfig, signal?: AbortSignal): Promise<PingResult> {
    connectionStatus.value[model.id] = 'testing'
    connectionError.value[model.id] = undefined
    try {
      const result = await ping(model, signal)
      connectionStatus.value[model.id] = result.ok ? 'ok' : 'failed'
      connectionLatency.value[model.id] = result.latency
      connectionError.value[model.id] = result.error
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      connectionStatus.value[model.id] = 'failed'
      connectionError.value[model.id] = msg
      return { ok: false, latency: 0, error: msg }
    }
  }

  // ====================== Actions: chat ======================
  /**
   * Run a streaming chat completion against the chosen model.
   * Returns the final aggregated message; intermediate deltas
   * are emitted through `onDelta`.
   */
  async function streamChat(
    modelId: string,
    messages: Message[],
    onDelta?: (delta: StreamDelta) => void,
    options?: { signal?: AbortSignal; systemPrompt?: string }
  ): Promise<AdapterChatMessage> {
    const model = models.value.find((m) => m.id === modelId)
    if (!model) throw new Error(`Model ${modelId} not configured`)
    const prompt = options?.systemPrompt ?? resolveSystemPrompt(modelId)
    return chat(model, messages, { ...options, systemPrompt: prompt }, onDelta)
  }

  // ====================== Exposed surface ======================
  return {
    // state
    models,
    settings,
    perModelPrompts,
    isLoading,
    error,
    connectionStatus,
    connectionLatency,
    connectionError,
    adapter,
    // getters
    enabledModels,
    defaultModel,
    getModelById,
    isReady,
    // settings
    loadAll,
    loadSettings,
    saveSettings,
    // models
    addModel,
    updateModel,
    deleteModel,
    setDefaultModel,
    toggleEnabled,
    reloadModels,
    seedDefaults,
    // prompts
    resolveSystemPrompt,
    getModelPrompt,
    setModelPrompt,
    clearModelPrompt,
    setDefaultSystemPrompt,
    // connectivity
    testConnection,
    // chat
    streamChat,
  }
})

/**
 * Backwards-compatible alias. The original code-path named the
 * store `useSettingsStore`; we keep that alias alive to avoid
 * surprising the options page that already imports it.
 */
export const useSettingsStore = useModelStore
