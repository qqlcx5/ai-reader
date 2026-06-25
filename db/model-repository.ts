/**
 * 模型配置仓库
 * 参考 doc/tasks/model-management.md 章节 1
 */
import { db } from './dexie';
import type { ModelProviderConfig } from '@/shared/types';
import { getSecret, setSecret, deleteSecret } from '@/shared/crypto/secret-store';

const API_KEY_PREFIX = 'apikey::';

export function newModelId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 9);
}

export async function putModel(model: ModelProviderConfig): Promise<void> {
  // API key 单独存到 secret store
  if (model.apiKey) {
    await setSecret(`${API_KEY_PREFIX}${model.id}`, model.apiKey);
  }
  const { apiKey: _, ...rest } = model;
  await db.models.put({ ...rest, apiKey: '' } as ModelProviderConfig);
}

export async function getModel(id: string): Promise<ModelProviderConfig | undefined> {
  const model = await db.models.get(id);
  if (!model) return undefined;
  const apiKey = await getSecret(`${API_KEY_PREFIX}${id}`);
  return { ...model, apiKey: apiKey || '' };
}

export async function listModels(): Promise<ModelProviderConfig[]> {
  const models = await db.models.toArray();
  return Promise.all(
    models.map(async (m) => {
      const apiKey = await getSecret(`${API_KEY_PREFIX}${m.id}`);
      return { ...m, apiKey: apiKey || '' };
    })
  );
}

export async function listEnabledModels(): Promise<ModelProviderConfig[]> {
  const all = await listModels();
  return all.filter((m) => m.enabled);
}

export async function deleteModel(id: string): Promise<void> {
  await deleteSecret(`${API_KEY_PREFIX}${id}`);
  await db.models.delete(id);
}

export async function setDefaultModel(id: string): Promise<void> {
  const { getAppSettings, setAppSettings } = await import('./dexie');
  const settings = await getAppSettings();
  await setAppSettings({ ...settings, defaultModelId: id });
}
