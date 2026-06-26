/**
 * Unit tests for `modelService`.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../db/dexie'
import { modelService } from './service'
import { modelRepository } from './model.repository'
import type { ModelProviderConfig } from '@db/schema'

const baseConfig: ModelProviderConfig = {
  id: 'm1',
  name: 'Test',
  provider: 'openai-compatible',
  enabled: true,
  apiKey: 'sk-x',
  baseUrl: 'https://api.example.com/v1',
  model: 'test-model',
  createdAt: 0,
  updatedAt: 0,
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await modelRepository.clear()
  vi.restoreAllMocks()
})

describe('modelService', () => {
  it('listConfigs() returns whatever the repository has', async () => {
    await modelRepository.upsert(baseConfig)
    const list = await modelService.listConfigs()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('m1')
  })

  it('replaceConfigs() atomically swaps the list', async () => {
    await modelRepository.upsert(baseConfig)
    const next: ModelProviderConfig = {
      ...baseConfig,
      id: 'm2',
      name: 'Second',
      isDefault: true,
    }
    await modelService.replaceConfigs([next])
    const list = await modelService.listConfigs()
    expect(list.map((m) => m.id)).toEqual(['m2'])
  })

  it('upsertConfig() returns the persisted record', async () => {
    const saved = await modelService.upsertConfig(baseConfig)
    expect(saved.id).toBe('m1')
    expect(saved.createdAt).toBeGreaterThan(0)
  })

  it('deleteConfig() also clears per-model prompt overrides', async () => {
    await modelRepository.upsert(baseConfig)
    const { settingsRepository } = await import('./settings.repository')
    await settingsRepository.set('model_prompts', { m1: 'do this', m2: 'leave me' })
    await modelService.deleteConfig('m1')
    const remaining = await settingsRepository.getJSON<Record<string, string>>('model_prompts', {})
    expect(remaining).toEqual({ m2: 'leave me' })
  })

  it('setDefault() flips the isDefault flag', async () => {
    await modelRepository.upsert({ ...baseConfig, isDefault: true })
    await modelRepository.upsert({ ...baseConfig, id: 'm2', isDefault: false })
    await modelService.setDefault('m2')
    const list = await modelService.listConfigs()
    const m2 = list.find((m) => m.id === 'm2')!
    const m1 = list.find((m) => m.id === 'm1')!
    expect(m2.isDefault).toBe(true)
    expect(m1.isDefault).toBe(false)
  })

  it('resolveSystemPrompt() prefers per-model override', async () => {
    await modelRepository.upsert({ ...baseConfig, systemPrompt: 'fallback from model' })
    const { settingsRepository } = await import('./settings.repository')
    await settingsRepository.set('app_settings', { defaultSystemPrompt: 'global default' })
    await settingsRepository.set('model_prompts', { m1: 'override wins' })
    const prompt = await modelService.resolveSystemPrompt('m1')
    expect(prompt).toBe('override wins')
  })

  it('resolveSystemPrompt() falls back to global default when no override', async () => {
    await modelRepository.upsert(baseConfig)
    const { settingsRepository } = await import('./settings.repository')
    await settingsRepository.set('app_settings', { defaultSystemPrompt: 'global default' })
    const prompt = await modelService.resolveSystemPrompt('m1')
    expect(prompt).toBe('global default')
  })

  it('pingModel() returns ok=false when the model does not exist', async () => {
    const result = await modelService.pingModel('nope')
    expect(result.ok).toBe(false)
  })
})
