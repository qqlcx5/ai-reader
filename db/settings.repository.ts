// ============================================================
// Settings Repository — Model Settings & General App Settings
// Uses chrome.storage.sync for cross-device sync (no secrets)
// ============================================================

import type { AppSettings, ModelConnectionStatus } from '../shared/domain';

const SYNC_KEY_APP_SETTINGS = 'superbrain_app_settings';
const SYNC_KEY_MODEL_SETTINGS = 'superbrain_model_settings';

export interface ModelSettings {
  /** Currently active provider id */
  activeProviderId: string;
  /** Currently active model name */
  activeModel: string;
  /** Derivation password id (a random token, stored in local storage separately) */
  derivationToken: string | null;
  /** Whether the user has completed initial setup */
  setupComplete: boolean;
}

const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  activeProviderId: 'deepseek',
  activeModel: 'deepseek-chat',
  derivationToken: null,
  setupComplete: false,
};

export class SettingsRepository {
  // ---- App Settings ----

  async getAppSettings(): Promise<AppSettings> {
    const result = await chrome.storage.sync.get(SYNC_KEY_APP_SETTINGS);
    return result[SYNC_KEY_APP_SETTINGS] ?? {
      autoSave: true,
      showToast: true,
      includeFrontmatter: true,
      readerStyle: 'light',
    };
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    await chrome.storage.sync.set({ [SYNC_KEY_APP_SETTINGS]: settings });
  }

  async updateAppSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getAppSettings();
    const updated = { ...current, ...partial };
    await this.saveAppSettings(updated);
    return updated;
  }

  // ---- Model Settings ----

  async getModelSettings(): Promise<ModelSettings> {
    const result = await chrome.storage.sync.get(SYNC_KEY_MODEL_SETTINGS);
    return { ...DEFAULT_MODEL_SETTINGS, ...(result[SYNC_KEY_MODEL_SETTINGS] ?? {}) };
  }

  async saveModelSettings(settings: ModelSettings): Promise<void> {
    await chrome.storage.sync.set({ [SYNC_KEY_MODEL_SETTINGS]: settings });
  }

  async updateModelSettings(partial: Partial<ModelSettings>): Promise<ModelSettings> {
    const current = await this.getModelSettings();
    const updated = { ...current, ...partial };
    await this.saveModelSettings(updated);
    return updated;
  }

  // ---- Derivation Token (local storage, not synced) ----

  private LOCAL_KEY_DERIV_TOKEN = 'superbrain_derivation_token';

  async getDerivationToken(): Promise<string | null> {
    const result = await chrome.storage.local.get(this.LOCAL_KEY_DERIV_TOKEN);
    return result[this.LOCAL_KEY_DERIV_TOKEN] ?? null;
  }

  async saveDerivationToken(token: string): Promise<void> {
    await chrome.storage.local.set({ [this.LOCAL_KEY_DERIV_TOKEN]: token });
  }
}

export const settingsRepo = new SettingsRepository();
