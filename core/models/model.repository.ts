import { db } from '@/db/dexie';
import type { ModelProviderConfig, SettingsEntry } from '@/db/schema';
import { now } from '@/shared/utils/time';
import { generateId } from '@/shared/utils/id';

const MODELS_KEY = 'model_providers';

export const modelRepository = {
  async getAll(): Promise<ModelProviderConfig[]> {
    const entry = await db.settings.get(MODELS_KEY);
    return (entry?.value as ModelProviderConfig[]) ?? [];
  },

  async getEnabled(): Promise<ModelProviderConfig[]> {
    const models = await this.getAll();
    return models.filter((m) => m.enabled);
  },

  async getById(id: string): Promise<ModelProviderConfig | undefined> {
    const models = await this.getAll();
    return models.find((m) => m.id === id);
  },

  async save(model: Omit<ModelProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<ModelProviderConfig> {
    const models = await this.getAll();
    const newModel: ModelProviderConfig = {
      ...model,
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    };
    models.push(newModel);
    await this._saveAll(models);
    return newModel;
  },

  async update(id: string, updates: Partial<ModelProviderConfig>): Promise<ModelProviderConfig | undefined> {
    const models = await this.getAll();
    const index = models.findIndex((m) => m.id === id);
    if (index === -1) return undefined;
    models[index] = { ...models[index], ...updates, updatedAt: now() };
    await this._saveAll(models);
    return models[index];
  },

  async delete(id: string): Promise<void> {
    const models = await this.getAll();
    const filtered = models.filter((m) => m.id !== id);
    await this._saveAll(filtered);
  },

  async _saveAll(models: ModelProviderConfig[]): Promise<void> {
    const entry: SettingsEntry = {
      key: MODELS_KEY,
      value: models,
      updatedAt: now(),
    };
    await db.settings.put(entry);
  },
};
