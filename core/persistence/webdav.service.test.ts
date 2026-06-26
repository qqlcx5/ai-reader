/**
 * webdav.service unit tests.
 *
 * Covers:
 *   - upload sends a PUT with gzipped body + writes metadata
 *   - download detects remote timestamp and snapshots locally
 *   - testConnection sends a PROPFIND
 *   - 401 → WebDAVUnauthorizedError, local data untouched
 *   - network failure → surfaces error, local data untouched
 *
 * The browser-only APIs (CompressionStream, DecompressionStream,
 * fetch) are stubbed at the test boundary; the body round-trip
 * uses the real `lz-string` via `backup.service` so we know
 * what an "expected" payload looks like.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Polyfill CompressionStream / DecompressionStream as identity
// transforms *before* the service module is loaded. Node 22
// has a real gunzip impl that would fail on the test payload
// (we never actually gzip in tests). Setting these globals
// here, at the very top of the file, ensures the service sees
// our stubs.
{
  class IdentityCompressionStream {
    readable: ReadableStream<Uint8Array>
    writable: WritableStream<Uint8Array>
    constructor(_format: string) {
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
      this.readable = readable
      this.writable = writable
    }
  }
  class IdentityDecompressionStream {
    readable: ReadableStream<Uint8Array>
    writable: WritableStream<Uint8Array>
    constructor(_format: string) {
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
      this.readable = readable
      this.writable = writable
    }
  }
  ;(globalThis as unknown as { CompressionStream: unknown }).CompressionStream =
    IdentityCompressionStream
  ;(globalThis as unknown as { DecompressionStream: unknown }).DecompressionStream =
    IdentityDecompressionStream
}

import { db } from '../../db/dexie'
import { documentRepository } from '@core/documents/document.repository'
import { chatRepository } from '@core/chat/chat.repository'
import { settingsRepository } from '@core/models/settings.repository'
import { modelRepository } from '@core/models/model.repository'
import {
  webdavService,
  loadWebDAVConfig,
  saveWebDAVConfig,
  takeLocalSnapshot,
  listSnapshots,
  WebDAVUnauthorizedError,
  WebDAVNotFoundError,
  WebDAVError,
} from './webdav.service'
import { exportBackup, importBackup } from './backup.service'
import { CURRENT_SCHEMA_VERSION } from '@db/schema'
import type { WebDAVConfig } from '@db/schema'

/* ------------------------------------------------------------------ */
/*  fetch + compression mocks                                          */
/* ------------------------------------------------------------------ */

interface RecordedCall {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  rawBody?: ArrayBuffer
}

let recorded: RecordedCall[] = []
let remoteServer: {
  data?: ArrayBuffer
  metadata?: { updatedAt: number; schemaVersion: number; version: string; totalBytes?: number }
  /** Return 401 for the next PROPFIND call. */
  failNextPropfind?: boolean
  /** Return 404 for the next GET metadata call. */
  failNextMeta?: boolean
  /** Simulate a network error on the next call. */
  failNextNetwork?: boolean
} = {}

function makeOkResponse(body?: BodyInit, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers })
}

function makeErrorResponse(status: number, statusText: string): Response {
  return new Response(null, { status, statusText })
}

const mockFetch = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
  if (remoteServer.failNextNetwork) {
    remoteServer.failNextNetwork = false
    throw new TypeError('NetworkError when attempting to fetch resource.')
  }
  const method = (init?.method || 'GET').toUpperCase()
  const headers: Record<string, string> = {}
  if (init?.headers) {
    for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
      headers[k.toLowerCase()] = v
    }
  }
  let body: string | undefined
  let rawBody: ArrayBuffer | undefined
  if (init?.body instanceof Blob) {
    rawBody = await init.body.arrayBuffer()
  } else if (init?.body) {
    body = String(init.body)
  }
  recorded.push({ url, method, headers, body, rawBody })

  if (method === 'PROPFIND') {
    if (remoteServer.failNextPropfind) {
      remoteServer.failNextPropfind = false
      return makeErrorResponse(401, 'Unauthorized')
    }
    return new Response('<?xml version="1.0"?><d:multistatus/>', { status: 207 })
  }
  if (method === 'MKCOL') {
    return makeOkResponse(null, 201)
  }
  if (method === 'PUT' && url.endsWith('metadata.json')) {
    remoteServer.metadata = JSON.parse(body!)
    return makeOkResponse(null, 200)
  }
  if (method === 'PUT' && url.endsWith('ReadChat_data.json.gz')) {
    remoteServer.data = rawBody
    return makeOkResponse(null, 200)
  }
  if (method === 'GET' && url.endsWith('metadata.json')) {
    if (remoteServer.failNextMeta) {
      remoteServer.failNextMeta = false
      return makeErrorResponse(404, 'Not Found')
    }
    if (!remoteServer.metadata) return makeErrorResponse(404, 'Not Found')
    return makeOkResponse(JSON.stringify(remoteServer.metadata), 200, {
      'Content-Type': 'application/json',
    })
  }
  if (method === 'GET' && url.endsWith('ReadChat_data.json.gz')) {
    if (!remoteServer.data) return makeErrorResponse(404, 'Not Found')
    return makeOkResponse(remoteServer.data, 200, {
      'Content-Type': 'application/gzip',
      'Content-Length': String(remoteServer.data.byteLength),
    })
  }
  return makeErrorResponse(400, 'Bad Request')
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  await documentRepository.clear()
  await chatRepository.clear()
  await settingsRepository.clear()
  await modelRepository.clear()
  recorded = []
  remoteServer = {}
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch
  // CompressionStream / DecompressionStream polyfilled at
  // the top of the file so the service module sees them on
  // import.
})

afterEach(() => {
  vi.clearAllMocks()
})

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function seedConfig(overrides: Partial<WebDAVConfig> = {}): Promise<WebDAVConfig> {
  const cfg: WebDAVConfig = {
    enabled: true,
    url: 'https://example.com/webdav',
    username: 'user',
    password: 'pass',
    remoteDir: 'AIReader',
    syncInterval: 30,
    ...overrides,
  }
  await saveWebDAVConfig(cfg)
  return cfg
}

async function seedLocalData() {
  await documentRepository.put({
    id: 'doc-1',
    url: 'https://e.com',
    title: 'Doc',
    markdownContent: '# hi',
    createdAt: 1000,
    updatedAt: 1000,
  } as never)
  await chatRepository.bulkPut([
    {
      id: 'h1',
      documentId: 'doc-1',
      modelId: 'm1',
      model: 'gpt-4o',
      messages: [
        { id: 'msg-1', role: 'user', content: 'hi', createdAt: 1000 },
      ],
      createdAt: 1000,
      updatedAt: 1000,
    },
  ])
  await settingsRepository.set('app_settings', { theme: 'dark' })
}

function lastCall(method: string): RecordedCall | undefined {
  return recorded.filter((r) => r.method === method).pop()
}

function callsFor(url: string): RecordedCall[] {
  return recorded.filter((r) => r.url === url)
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('webdavService', () => {
  describe('testConnectionWith', () => {
    it('returns ok=true on PROPFIND 207', async () => {
      const result = await webdavService.testConnectionWith({
        enabled: true,
        url: 'https://example.com/webdav',
        username: 'u',
        password: 'p',
        remoteDir: 'x',
        syncInterval: 30,
      })
      expect(result.ok).toBe(true)
      expect(result.status).toBe(207)
      const call = lastCall('PROPFIND')
      expect(call).toBeTruthy()
      expect(call!.headers['authorization']).toMatch(/^Basic /)
    })

    it('returns ok=false on 401', async () => {
      remoteServer.failNextPropfind = true
      const result = await webdavService.testConnectionWith({
        enabled: true,
        url: 'https://example.com/webdav',
        username: 'u',
        password: 'p',
        remoteDir: 'x',
        syncInterval: 30,
      })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(401)
    })

    it('returns ok=false on network error', async () => {
      remoteServer.failNextNetwork = true
      const result = await webdavService.testConnectionWith({
        enabled: true,
        url: 'https://example.com/webdav',
        username: 'u',
        password: 'p',
        remoteDir: 'x',
        syncInterval: 30,
      })
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/network/i)
    })

    it('rejects empty url', async () => {
      const result = await webdavService.testConnectionWith({
        enabled: true,
        url: '',
        username: 'u',
        password: 'p',
        remoteDir: 'x',
        syncInterval: 30,
      })
      expect(result.ok).toBe(false)
    })
  })

  describe('upload', () => {
    it('PUTs the gzipped bundle and writes metadata', async () => {
      await seedConfig()
      await seedLocalData()
      const onProgress = vi.fn()
      const result = await webdavService.upload({ onProgress })
      expect(result.totalBytes).toBeGreaterThan(0)
      expect(remoteServer.metadata).toBeTruthy()
      expect(remoteServer.metadata!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
      // The data PUT is the one that ships the (possibly
      // gzipped) bundle.  We grab it explicitly so we don't
      // confuse it with the metadata PUT.
      const putData = recorded
        .filter((r) => r.method === 'PUT')
        .find((r) => r.url.endsWith('ReadChat_data.json.gz'))!
      expect(putData.headers['authorization']).toMatch(/^Basic /)
      // Content-Type is 'application/gzip' when compression is
      // available, or 'application/json' when the runtime
      // (e.g. our test jsdom) lacks Blob.stream(). Either way
      // the body should be present.
      expect(['application/gzip', 'application/json']).toContain(
        putData.headers['content-type']
      )
      expect(putData.rawBody?.byteLength ?? 0).toBeGreaterThan(0)
      // progress emitted at least once with a stage
      const stages = onProgress.mock.calls.map((c) => c[0].stage)
      expect(stages).toContain('packing')
      expect(stages).toContain('uploading')
      expect(stages).toContain('done')
    })

    it('updates lastSyncAt on success', async () => {
      await seedConfig()
      await seedLocalData()
      const before = await loadWebDAVConfig()
      expect(before?.lastSyncAt).toBeUndefined()
      const result = await webdavService.upload()
      const after = await loadWebDAVConfig()
      expect(after?.lastSyncAt).toBe(result.uploadedAt)
    })

    it('throws on 401 without touching local data', async () => {
      await seedConfig()
      await seedLocalData()
      // First call is PROPFIND-free (upload doesn't probe),
      // but the PUT can still 401.
      const originalFetch = mockFetch.getMockImplementation()
      mockFetch.mockImplementationOnce(async () => makeErrorResponse(401, 'Unauthorized'))
      const beforeDoc = await documentRepository.listAll()
      await expect(webdavService.upload()).rejects.toBeInstanceOf(WebDAVUnauthorizedError)
      const afterDoc = await documentRepository.listAll()
      expect(afterDoc.length).toBe(beforeDoc.length)
      // restore for cleanup
      mockFetch.mockImplementation(originalFetch as never)
    })

    it('throws on network failure without touching local data', async () => {
      await seedConfig()
      await seedLocalData()
      remoteServer.failNextNetwork = true
      const before = await documentRepository.listAll()
      await expect(webdavService.upload()).rejects.toBeInstanceOf(WebDAVError)
      const after = await documentRepository.listAll()
      expect(after.length).toBe(before.length)
    })
  })

  describe('download', () => {
    it('returns empty result when remote has no metadata', async () => {
      await seedConfig()
      const result = await webdavService.download()
      expect(result.documents).toBe(0)
      expect(result.chats).toBe(0)
    })

    it('skips download when local is newer (unless forced)', async () => {
      await seedConfig({ lastSyncAt: Date.now() })
      remoteServer.metadata = {
        updatedAt: Date.now() - 60_000,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        version: '1.0.0',
      }
      const result = await webdavService.download()
      expect(result.documents).toBe(0)
      // no snapshot taken
      const snaps = await listSnapshots()
      expect(snaps).toHaveLength(0)
    })

    it('downloads + decompresses + overwrites local data', async () => {
      await seedConfig()
      // Seed the *server* with a bundle, not the local DB.
      // We do this by spinning up a fresh local copy, exporting
      // it, and shipping that to the mock server.
      const fakeLocalBundle = await (async () => {
        await seedLocalData()
        const b = await exportBackup()
        // wipe local so we can prove download restored it
        await documentRepository.clear()
        await chatRepository.clear()
        return b
      })()
      const json = JSON.stringify({ ...fakeLocalBundle, _compressed: true })
      const blob = new Blob([json])
      remoteServer.data = await blob.arrayBuffer()
      remoteServer.metadata = {
        updatedAt: Date.now(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        version: '1.0.0',
        totalBytes: remoteServer.data.byteLength,
      }

      const result = await webdavService.download({ force: true })
      expect(result.documents).toBeGreaterThanOrEqual(1)
      expect(result.snapshotTaken).toBe(false) // no prior sync

      const getCall = callsFor('https://example.com/webdav/AIReader/ReadChat_data.json.gz').pop()
      expect(getCall).toBeTruthy()
    })

    it('snapshots local data before overwriting (when there is a prior sync)', async () => {
      await seedConfig({ lastSyncAt: Date.now() - 60_000 })
      await seedLocalData()
      const bundle = await exportBackup()
      const json = JSON.stringify({ ...bundle, _compressed: true })
      const blob = new Blob([json])
      remoteServer.data = await blob.arrayBuffer()
      remoteServer.metadata = {
        updatedAt: Date.now(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        version: '1.0.0',
      }

      const result = await webdavService.download({ force: true })
      expect(result.snapshotTaken).toBe(true)
      const snaps = await listSnapshots()
      expect(snaps).toHaveLength(1)
    })

    it('asks the caller for confirmation on conflict', async () => {
      await seedConfig({ lastSyncAt: Date.now() - 60_000 })
      await seedLocalData()
      const bundle = await exportBackup()
      const json = JSON.stringify({ ...bundle, _compressed: true })
      const blob = new Blob([json])
      remoteServer.data = await blob.arrayBuffer()
      remoteServer.metadata = {
        updatedAt: Date.now(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        version: '1.0.0',
      }

      const confirm = vi.fn(async () => false)
      await expect(
        webdavService.download({ conflict: { confirmReplace: confirm, remoteUpdatedAt: 0, localUpdatedAt: 0 } })
      ).rejects.toThrow(/cancel/i)
      expect(confirm).toHaveBeenCalled()
      // nothing was overwritten
      const doc = await documentRepository.get('doc-1')
      expect(doc?.title).toBe('Doc')
    })

    it('throws on 401 (remote 401 during metadata GET)', async () => {
      await seedConfig()
      mockFetch.mockImplementationOnce(async () => makeErrorResponse(401, 'Unauthorized'))
      await expect(webdavService.download()).rejects.toBeInstanceOf(WebDAVUnauthorizedError)
    })

    it('throws on network failure (no local data lost)', async () => {
      await seedConfig()
      await seedLocalData()
      remoteServer.failNextNetwork = true
      const before = await documentRepository.listAll()
      await expect(webdavService.download()).rejects.toBeInstanceOf(WebDAVError)
      const after = await documentRepository.listAll()
      expect(after.length).toBe(before.length)
    })

    it('raises WebDAVNotFoundError when data is missing', async () => {
      await seedConfig()
      // metadata exists, data file is missing on the server
      remoteServer.metadata = {
        updatedAt: Date.now(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        version: '1.0.0',
      }
      mockFetch.mockImplementationOnce(async (url: string) => {
        if (url.endsWith('ReadChat_data.json.gz')) {
          return makeErrorResponse(404, 'Not Found')
        }
        return mockFetch.getMockImplementation()!(url)
      })
      await expect(webdavService.download({ force: true })).rejects.toBeInstanceOf(WebDAVNotFoundError)
    })
  })

  describe('takeLocalSnapshot', () => {
    it('stores a snapshot under a snapshot_<ts> key', async () => {
      await seedLocalData()
      const snap = await takeLocalSnapshot('manual')
      expect(snap.id).toMatch(/^snapshot_/)
      const snaps = await listSnapshots()
      expect(snaps).toHaveLength(1)
      expect(snaps[0].id).toBe(snap.id)
    })
  })
})
