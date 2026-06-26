/**
 * model.repository + settings.repository unit tests.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../db/dexie'
import { modelRepository } from './model.repository'
import { settingsRepository } from './settings.repository'
import type { ModelProviderConfig } from '@db/schema'

const baseConfig: ModelProviderConfig = {
  id: 'm1',
  name: 'GPT-4o',
  provider: 'openai-compatible',
  enabled: true,
  apiKey: 'sk-test',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  isDefault: true,
  createdAt: 0,
  updatedAt: 0,
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await modelRepository.clear()
})

describe('modelRepository', () => {
  it('upsert() stores a model and assigns a default', async () => {
    await modelRepository.upsert(baseConfig)
    const list = await modelRepository.list()
    expect(list).toHaveLength(1)
    expect(list[0].isDefault).toBe(true)
  })

  it('upsert() unsets previous default when a new default is added', async () => {
    await modelRepository.upsert(baseConfig)
    await modelRepository.upsert({ ...baseConfig, id: 'm2', isDefault: true, name: 'Claude' })
    const list = await modelRepository.list()
    const m1 = list.find((m) => m.id === 'm1')!
    const m2 = list.find((m) => m.id === 'm2')!
    expect(m1.isDefault).toBe(false)
    expect(m2.isDefault).toBe(true)
  })

  it('listEnabled() filters by enabled flag', async () => {
    await modelRepository.upsert(baseConfig)
    await modelRepository.upsert({ ...baseConfig, id: 'm2', enabled: false, isDefault: false })
    const enabled = await modelRepository.listEnabled()
    expect(enabled.map((m) => m.id)).toEqual(['m1'])
  })

  it('getDefault() returns the explicit default or first enabled', async () => {
    await modelRepository.upsert({ ...baseConfig, isDefault: false })
    await modelRepository.upsert({ ...baseConfig, id: 'm2', isDefault: false, name: 'A' })
    const def = await modelRepository.getDefault()
    expect(def?.id).toBe('m1')
  })

  it('seedDefaults() is a no-op when models already exist', async () => {
    await modelRepository.upsert(baseConfig)
    await modelRepository.seedDefaults()
    expect(await modelRepository.list()).toHaveLength(1)
  })

  it('seedDefaults() populates defaults on an empty store', async () => {
    await modelRepository.seedDefaults()
    const list = await modelRepository.list()
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list.some((m) => m.isDefault)).toBe(true)
  })
})

describe('settingsRepository', () => {
  it('set() and getJSON() round-trip a value', async () => {
    await settingsRepository.set('theme', 'dark')
    expect(await settingsRepository.getJSON('theme', 'light')).toBe('dark')
  })

  it('getJSON() returns fallback when the key is missing', async () => {
    expect(await settingsRepository.getJSON('missing', { a: 1 })).toEqual({ a: 1 })
  })
})
