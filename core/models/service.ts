/**
 * Background-friendly service helpers for the model subsystem.
 *
 * The background service worker doesn't have Vue/Pinia, so the
 * Pinia store is the wrong entry point from there. These thin
 * wrappers call `modelRepository` directly and are intended to
 * be invoked from the `background.ts` message handlers
 * (`GET_MODEL_CONFIGS` / `UPDATE_MODEL_CONFIGS` / `PING`).
 */

import { modelRepository } from './model.repository'
import { settingsRepository } from './settings.repository'
import { ping } from './openai-compat.adapter'
import type { ModelProviderConfig, AppSettings } from '@db/schema'

const SETTINGS_KEY = 'app_settings'
const PROMPT_KEY = 'model_prompts'

export const modelService = {
  /**
   * Return the current model list. Optionally include disabled
   * entries (default `true` to match the typed payload — the UI
   * can filter as it sees fit).
   */
  async listConfigs(): Promise<ModelProviderConfig[]> {
    return modelRepository.list()
  },

  /**
   * Replace the full list of model configs. Used by
   * `UPDATE_MODEL_CONFIGS` — atomic put, so a single message
   * yields one consistent state.
   */
  async replaceConfigs(configs: ModelProviderConfig[]): Promise<void> {
    await modelRepository.clear()
    await modelRepository.bulkPut(configs)
  },

  /** Upsert a single config; preserves the existing default if untouched. */
  async upsertConfig(config: ModelProviderConfig): Promise<ModelProviderConfig> {
    await modelRepository.upsert(config)
    return (await modelRepository.get(config.id))!
  },

  async deleteConfig(id: string): Promise<void> {
    await modelRepository.delete(id)
    // Best-effort cleanup of the per-model prompt override.
    const prompts = await settingsRepository.getJSON<Record<string, string>>(PROMPT_KEY, {})
    if (prompts[id] !== undefined) {
      delete prompts[id]
      await settingsRepository.set(PROMPT_KEY, prompts)
    }
  },

  async setDefault(id: string): Promise<void> {
    await modelRepository.setDefault(id)
  },

  /** Resolve the system prompt to use for a given model. */
  async resolveSystemPrompt(modelId?: string): Promise<string> {
    const [settings, prompts, defaultModel] = await Promise.all([
      settingsRepository.getJSON<AppSettings>(SETTINGS_KEY, {} as AppSettings),
      settingsRepository.getJSON<Record<string, string>>(PROMPT_KEY, {}),
      modelRepository.getDefault(),
    ])
    if (modelId && prompts[modelId]) return prompts[modelId]
    return (
      settings.defaultSystemPrompt ??
      // Final fallback to whichever model has a systemPrompt attached.
      defaultModel?.systemPrompt ??
      ''
    )
  },

  /** Run a connectivity probe (used by the `PING` message). */
  async pingModel(id: string, signal?: AbortSignal) {
    const config = await modelRepository.get(id)
    if (!config) return { ok: false, error: 'Model not found' }
    return ping(config, signal)
  },
}
