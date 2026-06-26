/**
 * settings.service unit tests.
 *
 * Exercises the AppSettings wrapper around
 * `settingsRepository`:
 *   - get() returns defaults when nothing is stored
 *   - get() merges defaults with stored partial state
 *   - update() persists the merge and returns the new state
 *   - reset() restores defaults
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../db/dexie'
import { settingsService, DEFAULT_APP_SETTINGS } from './settings.service'
import { settingsRepository } from '@core/models/settings.repository'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await settingsRepository.clear()
})

describe('settingsService', () => {
  it('get() returns defaults when nothing is persisted', async () => {
    const s = await settingsService.get()
    expect(s).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('get() merges defaults with the persisted object', async () => {
    await settingsRepository.set('app_settings', {
      theme: 'dark',
      // unknown keys are dropped
      madeUpKey: 123,
    })
    const s = await settingsService.get()
    expect(s.theme).toBe('dark')
    expect(s.showFloatingButton).toBe(DEFAULT_APP_SETTINGS.showFloatingButton)
    // unknown keys are not preserved
    expect((s as unknown as Record<string, unknown>).madeUpKey).toBeUndefined()
  })

  it('update() shallow-merges and persists', async () => {
    const a = await settingsService.update({ theme: 'dark', language: 'en-US' })
    expect(a.theme).toBe('dark')
    expect(a.language).toBe('en-US')
    // untouched fields are preserved
    expect(a.showFloatingButton).toBe(DEFAULT_APP_SETTINGS.showFloatingButton)

    const stored = await settingsRepository.get('app_settings')
    expect(stored?.value).toMatchObject({ theme: 'dark', language: 'en-US' })
  })

  it('update() returns the latest merged view', async () => {
    await settingsService.update({ theme: 'dark' })
    const second = await settingsService.update({ language: 'en-US' })
    expect(second.theme).toBe('dark')
    expect(second.language).toBe('en-US')
  })

  it('reset() restores defaults and persists them', async () => {
    await settingsService.update({ theme: 'dark', language: 'en-US' })
    const reset = await settingsService.reset()
    expect(reset).toEqual(DEFAULT_APP_SETTINGS)
    const stored = await settingsRepository.get('app_settings')
    expect(stored?.value).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('update() with an empty object is a no-op shape-wise', async () => {
    const before = await settingsService.get()
    const after = await settingsService.update({})
    expect(after).toEqual(before)
  })
})
