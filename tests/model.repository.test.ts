import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/dexie';
import { modelRepository } from '@/core/models/model.repository';

beforeEach(async () => {
  await db.settings.clear();
});

describe('modelRepository', () => {
  it('should save and retrieve models', async () => {
    const model = await modelRepository.save({
      name: 'DeepSeek Chat',
      provider: 'openai-compatible',
      enabled: true,
      apiKey: 'sk-test',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    });

    expect(model.id).toBeDefined();
    expect(model.name).toBe('DeepSeek Chat');
    expect(model.createdAt).toBeGreaterThan(0);

    const all = await modelRepository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(model.id);
  });

  it('should get enabled models only', async () => {
    await modelRepository.save({
      name: 'Enabled Model',
      provider: 'openai-compatible',
      enabled: true,
      apiKey: 'sk-1',
      baseUrl: 'https://api.test.com',
      model: 'model-1',
    });
    await modelRepository.save({
      name: 'Disabled Model',
      provider: 'openai-compatible',
      enabled: false,
      apiKey: 'sk-2',
      baseUrl: 'https://api.test.com',
      model: 'model-2',
    });

    const enabled = await modelRepository.getEnabled();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].name).toBe('Enabled Model');
  });

  it('should update a model', async () => {
    const model = await modelRepository.save({
      name: 'Original',
      provider: 'openai-compatible',
      enabled: true,
      apiKey: 'sk-test',
      baseUrl: 'https://api.test.com',
      model: 'model-1',
    });

    const updated = await modelRepository.update(model.id, { name: 'Updated' });
    expect(updated?.name).toBe('Updated');
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(model.updatedAt);
  });

  it('should delete a model', async () => {
    const model = await modelRepository.save({
      name: 'To Delete',
      provider: 'openai-compatible',
      enabled: true,
      apiKey: 'sk-test',
      baseUrl: 'https://api.test.com',
      model: 'model-1',
    });

    await modelRepository.delete(model.id);
    const all = await modelRepository.getAll();
    expect(all).toHaveLength(0);
  });
});
