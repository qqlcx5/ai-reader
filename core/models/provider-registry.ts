// ============================================================
// Provider Registry — Builtin + Custom Model Providers
// Persisted to chrome.storage.sync (no API keys)
// ============================================================

import type { ModelProvider, ModelConfig } from '../../shared/domain';

const STORAGE_KEY_PROVIDERS = 'superbrain_providers';

// ---- Builtin Providers ----

const BUILTIN_PROVIDERS: ModelProvider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    isBuiltin: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'claude',
    name: 'Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    isBuiltin: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    isBuiltin: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3.2', 'qwen2.5', 'mistral', 'gemma3'],
    isBuiltin: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

// ---- Provider Registry ----

export class ProviderRegistry {
  private providers: ModelProvider[] = [];
  private loaded = false;

  /**
   * Load providers from chrome.storage.sync. Merges builtins with user customizations.
   */
  async load(): Promise<ModelProvider[]> {
    const result = await chrome.storage.sync.get(STORAGE_KEY_PROVIDERS);
    const stored: ModelProvider[] = result[STORAGE_KEY_PROVIDERS] ?? [];

    // Merge: builtins take precedence for same id, stored customs appended
    const storedMap = new Map(stored.map((p) => [p.id, p]));
    const merged = BUILTIN_PROVIDERS.map((bp) => {
      const custom = storedMap.get(bp.id);
      if (custom) {
        // User may have modified baseUrl or models for a builtin
        return { ...bp, baseUrl: custom.baseUrl, models: custom.models };
      }
      return { ...bp };
    });

    // Append purely custom providers (not in builtins)
    for (const sp of stored) {
      if (!BUILTIN_PROVIDERS.find((bp) => bp.id === sp.id)) {
        merged.push(sp);
      }
    }

    this.providers = merged;
    this.loaded = true;
    return this.providers;
  }

  /**
   * Get all providers (must call load() first).
   */
  getAll(): ModelProvider[] {
    return [...this.providers];
  }

  /**
   * Get a single provider by id.
   */
  getById(id: string): ModelProvider | undefined {
    return this.providers.find((p) => p.id === id);
  }

  /**
   * Add a custom provider. Persisted to chrome.storage.sync.
   */
  async add(provider: Omit<ModelProvider, 'isBuiltin' | 'createdAt'>): Promise<ModelProvider> {
    if (!this.loaded) await this.load();

    const newProvider: ModelProvider = {
      ...provider,
      isBuiltin: false,
      createdAt: new Date().toISOString(),
    };

    this.providers.push(newProvider);
    await this.persist();
    return newProvider;
  }

  /**
   * Update a provider (builtin or custom). Only baseUrl and models can be changed.
   */
  async update(
    id: string,
    changes: Partial<Pick<ModelProvider, 'baseUrl' | 'models' | 'name'>>,
  ): Promise<ModelProvider | undefined> {
    if (!this.loaded) await this.load();

    const idx = this.providers.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;

    this.providers[idx] = { ...this.providers[idx], ...changes };
    await this.persist();
    return this.providers[idx];
  }

  /**
   * Remove a custom provider. Builtin providers cannot be deleted.
   */
  async remove(id: string): Promise<boolean> {
    if (!this.loaded) await this.load();

    const provider = this.providers.find((p) => p.id === id);
    if (!provider || provider.isBuiltin) return false;

    this.providers = this.providers.filter((p) => p.id !== id);
    await this.persist();
    return true;
  }

  /**
   * Check if a provider id is builtin.
   */
  isBuiltin(id: string): boolean {
    return BUILTIN_PROVIDERS.some((bp) => bp.id === id);
  }

  /**
   * Build a full ModelConfig from a provider id + model name.
   */
  buildConfig(providerId: string, modelName: string): ModelConfig | undefined {
    const provider = this.getById(providerId);
    if (!provider) return undefined;
    return {
      providerId: provider.id,
      providerName: provider.name,
      modelName,
      baseUrl: provider.baseUrl,
    };
  }

  // ---- Internal ----

  private async persist(): Promise<void> {
    // Only persist custom providers (non-builtin)
    const customs = this.providers.filter((p) => !p.isBuiltin);
    // Also persist builtins that have been modified
    const modifiedBuiltins = this.providers.filter((p) => {
      if (!p.isBuiltin) return false;
      const orig = BUILTIN_PROVIDERS.find((bp) => bp.id === p.id);
      if (!orig) return false;
      return orig.baseUrl !== p.baseUrl || JSON.stringify(orig.models) !== JSON.stringify(p.models);
    });

    await chrome.storage.sync.set({
      [STORAGE_KEY_PROVIDERS]: [...modifiedBuiltins, ...customs],
    });
  }
}

export const providerRegistry = new ProviderRegistry();
