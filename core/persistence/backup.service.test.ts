/**
 * backup.service unit tests.
 *
 * Verifies the four contracts:
 *   - exportBackup includes all three data classes
 *   - importBackup replace mode overwrites local data
 *   - importBackup merge mode adds without deleting
 *   - lz-string round-trip on compressed fields
 *   - schemaVersion mismatch is rejected
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import LZString from 'lz-string'
import { db } from '../../db/dexie'
import { documentRepository } from '@core/documents/document.repository'
import { chatRepository } from '@core/chat/chat.repository'
import { settingsRepository } from '@core/models/settings.repository'
import { modelRepository } from '@core/models/model.repository'
import { DEFAULT_MODELS } from '@shared/constants'
import {
  exportBackup,
  importBackup,
  parseBackup,
  BackupVersionError,
  BackupValidationError,
  __testing,
} from './backup.service'
import { CURRENT_SCHEMA_VERSION } from '@db/schema'
import type { CapturedDocument, ChatHistory } from '@db/schema'

const SAMPLE_DOC: Partial<CapturedDocument> = {
  id: 'doc-1',
  url: 'https://example.com/post-1',
  title: 'Post One',
  markdownContent: '# Heading\n\n' + 'lorem ipsum '.repeat(500),
  rawHtml: '<article>' + '<p>raw html</p>'.repeat(200) + '</article>',
  createdAt: 1000,
  updatedAt: 1000,
}

const SAMPLE_CHAT: ChatHistory = {
  id: 'h1',
  documentId: 'doc-1',
  modelId: 'm1',
  model: 'gpt-4o',
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Tell me about the document. '.repeat(80),
      createdAt: 1000,
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Here is a long response. '.repeat(120),
      createdAt: 2000,
    },
  ],
  createdAt: 1000,
  updatedAt: 2000,
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await documentRepository.clear()
  await chatRepository.clear()
  await settingsRepository.clear()
  await modelRepository.clear()
})

async function seedLocal() {
  await documentRepository.put(SAMPLE_DOC as CapturedDocument)
  await chatRepository.bulkPut([SAMPLE_CHAT])
  await settingsRepository.set('app_settings', { theme: 'dark' })
  await modelRepository.bulkPut(
    DEFAULT_MODELS.map((m, i) => ({
      ...m,
      createdAt: 1000,
      updatedAt: 1000,
      isDefault: i === 0,
    }))
  )
}

describe('exportBackup', () => {
  it('includes documents, chatHistories, settings, and models', async () => {
    await seedLocal()
    const bundle = await exportBackup()
    expect(bundle.documents.length).toBe(1)
    expect(bundle.chatHistories.length).toBe(1)
    expect(bundle.settings.length).toBeGreaterThan(0)
    expect(bundle.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect((bundle as unknown as { models: unknown[] }).models.length).toBe(
      DEFAULT_MODELS.length
    )
  })

  it('compresses large text fields', async () => {
    await seedLocal()
    const bundle = await exportBackup()
    const doc = bundle.documents[0]
    // compressed payload is shorter than the original
    expect(typeof doc.markdownContent).toBe('string')
    expect(doc.markdownContent.length).toBeLessThan(SAMPLE_DOC.markdownContent!.length)
    // round-trip via __testing helpers yields the original
    const decompressed = __testing.decompressField(doc.markdownContent)
    expect(decompressed).toBe(SAMPLE_DOC.markdownContent)
  })
})

describe('importBackup', () => {
  it('replace mode overwrites all data', async () => {
    await seedLocal()
    const bundle = await exportBackup()
    // mutate the bundle
    bundle.documents[0].title = 'MUTATED'

    const summary = await importBackup(bundle, { replace: true })
    expect(summary.replaced).toBe(true)
    expect(summary.documents).toBe(1)
    expect(summary.chats).toBe(1)

    const doc = await documentRepository.get('doc-1')
    expect(doc?.title).toBe('MUTATED')
  })

  it('merge mode does not clear existing data', async () => {
    await seedLocal()
    // add a second doc that will be wiped on replace
    await documentRepository.put({ id: 'doc-2', url: 'u2', title: 't2', markdownContent: '' } as CapturedDocument)

    const bundle = await exportBackup()
    // strip down to the single original doc
    bundle.documents = bundle.documents.filter((d) => d.id === 'doc-1')

    const summary = await importBackup(bundle, { replace: false })
    expect(summary.replaced).toBe(false)
    const all = await documentRepository.listAll()
    expect(all.map((d) => d.id).sort()).toEqual(['doc-1', 'doc-2'])
  })

  it('rejects bundles with a wrong schemaVersion', async () => {
    await seedLocal()
    const bundle = await exportBackup()
    const tampered = { ...bundle, schemaVersion: CURRENT_SCHEMA_VERSION + 99 }
    await expect(importBackup(tampered)).rejects.toBeInstanceOf(BackupVersionError)
  })

  it('skips version check when asked', async () => {
    await seedLocal()
    const bundle = await exportBackup()
    const tampered = { ...bundle, schemaVersion: 0 }
    // no throw
    const summary = await importBackup(tampered, { skipVersionCheck: true })
    expect(summary.documents).toBe(1)
  })
})

describe('parseBackup', () => {
  it('rejects non-objects', () => {
    expect(() => parseBackup('not a json object' as unknown as object)).toThrow(BackupValidationError)
    expect(() => parseBackup(null)).toThrow(BackupValidationError)
  })

  it('rejects missing schemaVersion', () => {
    expect(() => parseBackup({ version: '1', documents: [], chatHistories: [], settings: [] })).toThrow(
      /schemaVersion/
    )
  })
})

describe('lz-string round-trip', () => {
  it('compresses and decompresses the same text', () => {
    const original = 'Hello world, this is a test.\n'.repeat(100)
    const compressed = LZString.compressToUTF16(original)
    const decompressed = LZString.decompressFromUTF16(compressed)
    expect(decompressed).toBe(original)
  })

  it('preserves unicode in compressed messages', () => {
    const original = '你好，世界！🌍 一些中文内容，包含 emoji 🚀'.repeat(50)
    const compressed = LZString.compressToUTF16(original)
    expect(LZString.decompressFromUTF16(compressed)).toBe(original)
  })

  it('handles empty strings gracefully', () => {
    expect(__testing.compressField('')).toBe('')
    expect(__testing.compressField(undefined)).toBeUndefined()
    expect(__testing.compressField(null)).toBeNull()
  })
})
