// ============================================================
// Model Config Repository
// - Provider config (no API key) → chrome.storage.sync
// - API key (encrypted via AES-GCM) → chrome.storage.local
// ============================================================

import type { StoredProviderConfig, ModelConfigFull, ModelConnectionStatus } from '../shared/domain';
import { encryptApiKey, decryptApiKey, deriveKey } from '../core/crypto/aes-gcm';

const SYNC_KEY_CONFIG = 'superbrain_model_config';
const LOCAL_KEY_API_KEY = 'superbrain_api_key_encrypted';
const LOCAL_KEY_SALT = 'superbrain_api_key_salt';

export class ModelConfigRepository {
  // ---- Provider Config (sync storage) ----

  async getConfig(): Promise<StoredProviderConfig | null> {
    const result = await chrome.storage.sync.get(SYNC_KEY_CONFIG);
    return result[SYNC_KEY_CONFIG] ?? null;
  }

  async saveConfig(config: StoredProviderConfig): Promise<void> {
    await chrome.storage.sync.set({ [SYNC_KEY_CONFIG]: config });
  }

  async clearConfig(): Promise<void> {
    await chrome.storage.sync.remove(SYNC_KEY_CONFIG);
  }

  // ---- API Key (local storage, encrypted) ----

  /**
   * Save API key: encrypt with a derivation password, store ciphertext + salt.
   * The derivation password is fixed per-extension-install (random generated on first use).
   */
  async saveApiKey(apiKey: string, derivePassword: string): Promise<void> {
    const { cryptoKey, salt } = await deriveKey(derivePassword);
    const encrypted = await encryptApiKey(apiKey, cryptoKey);

    await chrome.storage.local.set({
      [LOCAL_KEY_API_KEY]: encrypted,
      [LOCAL_KEY_SALT]: Array.from(salt),
    });
  }

  /**
   * Load and decrypt the API key from local storage.
   */
  async loadApiKey(derivePassword: string): Promise<string | null> {
    const result = await chrome.storage.local.get([LOCAL_KEY_API_KEY, LOCAL_KEY_SALT]);
    const encrypted: string | undefined = result[LOCAL_KEY_API_KEY];
    const saltArr: number[] | undefined = result[LOCAL_KEY_SALT];

    if (!encrypted || !saltArr) return null;

    const salt = new Uint8Array(saltArr);
    const { cryptoKey } = await deriveKey(derivePassword, salt);
    return decryptApiKey(encrypted, cryptoKey);
  }

  /**
   * Check if an API key has been saved.
   */
  async hasApiKey(): Promise<boolean> {
    const result = await chrome.storage.local.get(LOCAL_KEY_API_KEY);
    return !!result[LOCAL_KEY_API_KEY];
  }

  /**
   * Delete stored API key.
   */
  async deleteApiKey(): Promise<void> {
    await chrome.storage.local.remove([LOCAL_KEY_API_KEY, LOCAL_KEY_SALT]);
  }

  // ---- Connection Status ----

  private CONN_STATUS_KEY = 'superbrain_connection_status';

  async saveConnectionStatus(status: ModelConnectionStatus): Promise<void> {
    await chrome.storage.local.set({ [this.CONN_STATUS_KEY]: status });
  }

  async getConnectionStatus(): Promise<ModelConnectionStatus | null> {
    const result = await chrome.storage.local.get(this.CONN_STATUS_KEY);
    return result[this.CONN_STATUS_KEY] ?? null;
  }

  // ---- Full Config (in-memory assembly, not persisted directly) ----

  /**
   * Assemble the full config with plaintext API key.
   * The API key is only in memory and never written to storage as plaintext.
   */
  async getFullConfig(derivePassword: string): Promise<ModelConfigFull | null> {
    const config = await this.getConfig();
    if (!config) return null;

    const apiKey = await this.loadApiKey(derivePassword);
    if (!apiKey) return null;

    return {
      providerId: config.providerId,
      providerName: config.providerName,
      modelName: config.modelName,
      baseUrl: config.baseUrl,
      apiKey,
    };
  }
}

export const modelConfigRepo = new ModelConfigRepository();
