/**
 * WebDAV sync service.
 *
 * Whole-bundle upload / download against a WebDAV-compatible
 * server (Nutstore, Nextcloud, Synology, …).  Two files are
 * stored on the remote:
 *
 *   <remoteDir>/ReadChat_data.json.gz   ← gzipped JSON backup
 *   <remoteDir>/metadata.json           ← { updatedAt, schemaVersion, version }
 *
 * The data file is gzipped with the browser's native
 * `CompressionStream('gzip')` (Chrome 80+, Firefox 113+,
 * Safari 16.4+) — no extra dependencies.  The inner JSON
 * follows the same `BackupBundle` shape as `backup.service.ts`
 * so import / export stay symmetric.
 *
 * Concurrency / error semantics
 *   - 401 / network errors: surfaced to the caller, the local
 *     data is *never* touched.
 *   - Download conflict (remote newer than local): the
 *     caller decides what to do; we expose a `confirmReplace`
 *     callback.  When accepted, we snapshot the current local
 *     state under the `chatHistories` table (a hidden
 *     "snapshot_<ts>" entry) before overwriting.
 */

import { CURRENT_SCHEMA_VERSION } from '@db/schema'
import type {
  BackupBundle,
  CapturedDocument,
  ChatHistory,
  SettingsEntry,
  WebDAVConfig,
} from '@db/schema'
import { documentRepository } from '@core/documents/document.repository'
import { chatRepository } from '@core/chat/chat.repository'
import { modelRepository } from '@core/models/model.repository'
import { settingsRepository } from '@core/models/settings.repository'
import { exportBackup, importBackup, parseBackup, BackupVersionError } from './backup.service'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ProgressInfo {
  stage: 'reading' | 'packing' | 'uploading' | 'downloading' | 'done' | 'error'
  /** 0..100 (best effort). */
  percent?: number
  /** Set when `stage === 'error'`. */
  error?: string
}

export interface UploadResult {
  uploadedAt: number
  totalBytes: number
  remotePath: string
  metadataPath: string
}

export interface DownloadResult {
  documents: number
  chats: number
  models: number
  settings: number
  remoteUpdatedAt: number
  snapshotTaken: boolean
}

export interface TestConnectionResult {
  ok: boolean
  error?: string
  status?: number
}

export interface SyncConflict {
  remoteUpdatedAt: number
  localUpdatedAt: number
  /** Pass `true` to overwrite the local DB; `false` to abort. */
  confirmReplace?: () => Promise<boolean> | boolean
}

export class WebDAVError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'WebDAVError'
  }
}

export class WebDAVUnauthorizedError extends WebDAVError {
  constructor() {
    super('Unauthorized (HTTP 401) — check username and password', 401)
    this.name = 'WebDAVUnauthorizedError'
  }
}

export class WebDAVNotFoundError extends WebDAVError {
  constructor(path: string) {
    super(`Not found on WebDAV server: ${path}`, 404)
    this.name = 'WebDAVNotFoundError'
  }
}

const DATA_FILENAME = 'ReadChat_data.json.gz'
const METADATA_FILENAME = 'metadata.json'
const SNAPSHOT_KEY_PREFIX = 'snapshot_'

/* ------------------------------------------------------------------ */
/*  Helpers — URL building, auth, gzip                                 */
/* ------------------------------------------------------------------ */

function normalizeBaseUrl(url: string): string {
  // Strip a single trailing slash so we can join paths
  // reliably.  We never normalise the scheme/host — that's
  // the caller's responsibility.
  return url.replace(/\/+$/, '')
}

function joinUrl(base: string, ...parts: string[]): string {
  const trimmed = normalizeBaseUrl(base)
  const tail = parts
    .filter(Boolean)
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .join('/')
  return tail ? `${trimmed}/${tail}` : trimmed
}

function buildAuthHeader(config: WebDAVConfig): string {
  // Browsers expose `btoa` globally; if not (SSR / worker)
  // the caller is using this in the wrong context.
  const token =
    typeof btoa === 'function'
      ? btoa(`${config.username}:${config.password}`)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (Buffer.from(`${config.username}:${config.password}`).toString('base64') as any)
  return `Basic ${token}`
}

function resolvePaths(config: WebDAVConfig): { data: string; meta: string; base: string } {
  const base = normalizeBaseUrl(config.url)
  const dir = config.remoteDir?.replace(/^\/+|\/+$/g, '') || ''
  return {
    base,
    data: joinUrl(base, dir, DATA_FILENAME),
    meta: joinUrl(base, dir, METADATA_FILENAME),
  }
}

interface GzipResult {
  blob: Blob
  /** True when the bytes are actually gzip-compressed. */
  compressed: boolean
}

async function gzipString(input: string): Promise<GzipResult> {
  // Browsers (Chrome 80+, FF 113+, Safari 16.4+) implement
  // `Blob.stream()` + `CompressionStream('gzip')` natively.
  // When those are unavailable (e.g. some test environments
  // that don't polyfill `Blob.stream()`), fall back to the
  // raw bytes.  In practice this never runs in production;
  // it's here so the service stays importable in weird
  // environments.
  const bytes = new TextEncoder().encode(input)
  const blob = new Blob([bytes])
  if (typeof blob.stream !== 'function' || typeof CompressionStream === 'undefined') {
    return { blob, compressed: false }
  }
  try {
    const stream = blob.stream().pipeThrough(new CompressionStream('gzip'))
    const compressed = await new Response(stream).blob()
    return { blob: compressed, compressed: true }
  } catch {
    return { blob, compressed: false }
  }
}

async function gunzipBlob(blob: Blob): Promise<string> {
  if (typeof blob.stream !== 'function' || typeof DecompressionStream === 'undefined') {
    // No streaming decompress — read the body as plain text
    // so callers still get *something* usable in tests.
    return await blob.text()
  }
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).text()
}

async function fetchWithProgress(
  url: string,
  init: RequestInit,
  onProgress?: (loaded: number, total?: number) => void
): Promise<Response> {
  const response = await safeFetch(url, init)
  if (!response.ok) return response
  if (!response.body || !onProgress) return response

  // Wrap the body so we can report progress.
  const totalHeader = response.headers.get('Content-Length')
  const total = totalHeader ? Number(totalHeader) : undefined
  const reader = response.body.getReader()
  let loaded = 0
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      if (value) {
        loaded += value.byteLength
        onProgress(loaded, total)
        controller.enqueue(value)
      }
    },
    cancel() {
      reader.cancel()
    },
  })
  // Replace the body with our streaming version.
  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

function wrapHttpError(response: Response, context: string): never {
  if (response.status === 401) {
    throw new WebDAVUnauthorizedError()
  }
  if (response.status === 404) {
    throw new WebDAVNotFoundError(context)
  }
  throw new WebDAVError(
    `WebDAV ${context} failed: HTTP ${response.status} ${response.statusText}`.trim(),
    response.status
  )
}

/**
 * Run a fetch call, wrapping network errors into WebDAVError so
 * the caller can rely on a uniform error type.
 */
async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    throw new WebDAVError(
      `WebDAV request to ${url} failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/* ------------------------------------------------------------------ */
/*  Snapshot helpers                                                   */
/* ------------------------------------------------------------------ */

interface LocalSnapshot {
  id: string
  takenAt: number
  documents: CapturedDocument[]
  chatHistories: ChatHistory[]
  settings: SettingsEntry[]
  models: unknown[]
}

/** Store a snapshot of the current local state. */
export async function takeLocalSnapshot(reason: string): Promise<LocalSnapshot> {
  const ts = Date.now()
  const id = `${SNAPSHOT_KEY_PREFIX}${ts}`
  const snapshot: LocalSnapshot = {
    id,
    takenAt: ts,
    reason,
    documents: await documentRepository.listAll(),
    chatHistories: await chatRepository.list(),
    settings: await settingsRepository.list(),
    models: await modelRepository.list(),
  } as LocalSnapshot & { reason: string }
  await settingsRepository.set(id, snapshot)
  return snapshot
}

/** List existing snapshots (most recent first). */
export async function listSnapshots(): Promise<LocalSnapshot[]> {
  const all = await settingsRepository.list()
  return all
    .filter((e) => e.key.startsWith(SNAPSHOT_KEY_PREFIX))
    .map((e) => e.value as LocalSnapshot)
    .sort((a, b) => b.takenAt - a.takenAt)
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

export interface WebDAVService {
  testConnection(): Promise<TestConnectionResult>
  testConnectionWith(config: WebDAVConfig): Promise<TestConnectionResult>
  upload(opts?: { onProgress?: (info: ProgressInfo) => void }): Promise<UploadResult>
  download(
    opts?: {
      force?: boolean
      conflict?: SyncConflict
      onProgress?: (info: ProgressInfo) => void
    }
  ): Promise<DownloadResult>
  getRemoteMetadata(): Promise<RemoteMetadata | null>
}

export interface RemoteMetadata {
  updatedAt: number
  schemaVersion: number
  version?: string
  totalBytes?: number
}

function isRemoteMetadata(value: unknown): value is RemoteMetadata {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.updatedAt === 'number' && typeof v.schemaVersion === 'number'
}

export const webdavService: WebDAVService = {
  /* ---------- Test connection ---------- */

  async testConnection(): Promise<TestConnectionResult> {
    const config = await loadWebDAVConfig()
    if (!config) return { ok: false, error: 'WebDAV is not configured' }
    return this.testConnectionWith(config)
  },

  async testConnectionWith(config: WebDAVConfig): Promise<TestConnectionResult> {
    if (!config.url) return { ok: false, error: 'URL is empty' }
    const { base } = resolvePaths(config)
    try {
      const response = await fetch(base, {
        method: 'PROPFIND',
        headers: {
          Authorization: buildAuthHeader(config),
          Depth: '0',
        },
      })
      if (response.status === 401) {
        return { ok: false, error: 'Unauthorized (HTTP 401)', status: 401 }
      }
      if (response.ok || response.status === 207) {
        return { ok: true, status: response.status }
      }
      return {
        ok: false,
        error: `HTTP ${response.status} ${response.statusText}`.trim(),
        status: response.status,
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Network error',
      }
    }
  },

  /* ---------- Remote metadata ---------- */

  async getRemoteMetadata(): Promise<RemoteMetadata | null> {
    const config = await loadWebDAVConfig()
    if (!config) return null
    const { meta } = resolvePaths(config)
    const response = await safeFetch(meta, {
      method: 'GET',
      headers: { Authorization: buildAuthHeader(config) },
    })
    if (response.status === 404) return null
    if (!response.ok) wrapHttpError(response, `GET ${meta}`)
    try {
      const json = (await response.json()) as unknown
      return isRemoteMetadata(json) ? json : null
    } catch {
      return null
    }
  },

  /* ---------- Upload ---------- */

  async upload(opts: { onProgress?: (info: ProgressInfo) => void } = {}): Promise<UploadResult> {
    const { onProgress } = opts
    const config = await loadWebDAVConfig()
    if (!config) throw new WebDAVError('WebDAV is not configured')

    const { data, meta, base } = resolvePaths(config)

    onProgress?.({ stage: 'reading', percent: 0 })

    // 1) Build the in-memory bundle (also compresses large fields).
    const bundle = await exportBackup()
    const json = JSON.stringify({ ...bundle, _compressed: true })
    onProgress?.({ stage: 'packing', percent: 30 })

    // 2) Gzip the whole thing.
    const { blob: gz, compressed: gzipped } = await gzipString(json)
    onProgress?.({ stage: 'uploading', percent: 50 })

    // 3) PUT the data file.  Use raw fetch (no progress
    //    reader) — `fetch` doesn't expose upload progress
    //    from a `Blob` body, but the operation is fast
    //    enough that the per-byte progress isn't useful.
    // 3a) MKCOL the remote dir first.
    const dir = config.remoteDir?.replace(/^\/+|\/+$/g, '') || ''
    if (dir) {
      const dirUrl = joinUrl(base, dir)
      const mkcol = await safeFetch(dirUrl, {
        method: 'MKCOL',
        headers: { Authorization: buildAuthHeader(config) },
      })
      // 405 = already exists, that's fine.
      if (!mkcol.ok && mkcol.status !== 405 && mkcol.status !== 301) {
        wrapHttpError(mkcol, `MKCOL ${dirUrl}`)
      }
    }

    const putData = await safeFetch(data, {
      method: 'PUT',
      headers: {
        Authorization: buildAuthHeader(config),
        'Content-Type': gzipped ? 'application/gzip' : 'application/json',
        'Content-Length': String(gz.size),
      },
      body: gz,
    })
    if (!putData.ok) wrapHttpError(putData, `PUT ${data}`)
    onProgress?.({ stage: 'uploading', percent: 85 })

    // 4) PUT the metadata file.
    const uploadedAt = Date.now()
    const metadata: RemoteMetadata = {
      updatedAt: uploadedAt,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      version: bundle.version,
      totalBytes: gz.size,
    }
    const putMeta = await safeFetch(meta, {
      method: 'PUT',
      headers: {
        Authorization: buildAuthHeader(config),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    })
    if (!putMeta.ok) wrapHttpError(putMeta, `PUT ${meta}`)

    // 5) Persist lastSyncAt on our side.
    const updated: WebDAVConfig = { ...config, lastSyncAt: uploadedAt }
    await settingsRepository.set('webdav_config', updated)

    onProgress?.({ stage: 'done', percent: 100 })
    return {
      uploadedAt,
      totalBytes: gz.size,
      remotePath: data,
      metadataPath: meta,
    }
  },

  /* ---------- Download ---------- */

  async download(opts: {
    force?: boolean
    conflict?: SyncConflict
    onProgress?: (info: ProgressInfo) => void
  } = {}): Promise<DownloadResult> {
    const { force = false, conflict, onProgress } = opts
    const config = await loadWebDAVConfig()
    if (!config) throw new WebDAVError('WebDAV is not configured')

    const { data, meta } = resolvePaths(config)
    onProgress?.({ stage: 'reading', percent: 0 })

    // 1) Read remote metadata.
    const metaResp = await safeFetch(meta, {
      method: 'GET',
      headers: { Authorization: buildAuthHeader(config) },
    })
    if (metaResp.status === 404) {
      // Nothing on the server yet — treat as empty bundle.
      return { documents: 0, chats: 0, models: 0, settings: 0, remoteUpdatedAt: 0, snapshotTaken: false }
    }
    if (!metaResp.ok) wrapHttpError(metaResp, `GET ${meta}`)
    const remoteMeta = (await metaResp.json()) as RemoteMetadata

    // 2) Conflict check.
    if (!force && config.lastSyncAt && remoteMeta.updatedAt <= config.lastSyncAt) {
      // Local is newer — no-op.
      return {
        documents: 0,
        chats: 0,
        models: 0,
        settings: 0,
        remoteUpdatedAt: remoteMeta.updatedAt,
        snapshotTaken: false,
      }
    }

    if (conflict?.confirmReplace) {
      const ok = await conflict.confirmReplace()
      if (!ok) {
        throw new WebDAVError('Download cancelled by user')
      }
    }

    // 3) Snapshot local data *before* overwriting.
    let snapshotTaken = false
    if (config.lastSyncAt) {
      // Only snapshot if there is something worth saving
      // (i.e. we already synced at least once).
      await takeLocalSnapshot(`pre-download-${remoteMeta.updatedAt}`)
      snapshotTaken = true
    }

    // 4) Download + decompress the bundle.
    onProgress?.({ stage: 'downloading', percent: 10 })
    const dataResp = await fetchWithProgress(
      data,
      {
        method: 'GET',
        headers: { Authorization: buildAuthHeader(config) },
      },
      (loaded, total) => {
        const percent = total ? 10 + Math.floor((loaded / total) * 70) : 50
        onProgress?.({ stage: 'downloading', percent })
      }
    )
    if (!dataResp.ok) wrapHttpError(dataResp, `GET ${data}`)
    const gz = await dataResp.blob()
    onProgress?.({ stage: 'downloading', percent: 85 })

    const text = await gunzipBlob(gz)
    onProgress?.({ stage: 'packing', percent: 90 })

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      throw new WebDAVError(
        `Failed to parse remote backup: ${err instanceof Error ? err.message : String(err)}`
      )
    }
    const bundle = parseBackup(parsed)
    const summary = await importBackup(bundle, { replace: true })

    // 5) Update lastSyncAt.
    const updated: WebDAVConfig = {
      ...config,
      lastSyncAt: remoteMeta.updatedAt,
    }
    await settingsRepository.set('webdav_config', updated)

    onProgress?.({ stage: 'done', percent: 100 })
    return {
      documents: summary.documents,
      chats: summary.chats,
      models: summary.models,
      settings: summary.settings,
      remoteUpdatedAt: remoteMeta.updatedAt,
      snapshotTaken,
    }
  },
}

/* ------------------------------------------------------------------ */
/*  Config loading                                                     */
/* ------------------------------------------------------------------ */

const WEBDAV_KEY = 'webdav_config'
const LEGACY_WEBDAV_KEY = 'ai_reader_webdav'

export async function loadWebDAVConfig(): Promise<WebDAVConfig | null> {
  // First read the canonical key.  If empty, fall back to the
  // legacy `ai_reader_webdav` key (used by the v2 prototype)
  // and migrate it forward.
  let raw = await settingsRepository.getJSON<unknown>(WEBDAV_KEY, null)
  if (!raw) {
    const legacy = await settingsRepository.getJSON<unknown>(LEGACY_WEBDAV_KEY, null)
    if (legacy) {
      raw = legacy
      await settingsRepository.set(WEBDAV_KEY, legacy)
      // Best-effort cleanup; ignore failures (the row may
      // not be a real settings entry).
      try {
        await settingsRepository.delete(LEGACY_WEBDAV_KEY)
      } catch {
        // ignore
      }
    }
  }
  if (!raw) return null
  if (typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  return {
    enabled: Boolean(r.enabled),
    url: typeof r.url === 'string' ? r.url : '',
    username: typeof r.username === 'string' ? r.username : '',
    password: typeof r.password === 'string' ? r.password : '',
    remoteDir:
      typeof r.remoteDir === 'string' ? r.remoteDir : 'AIReader_Backup',
    syncInterval: typeof r.syncInterval === 'number' ? r.syncInterval : 30,
    lastSyncAt: typeof r.lastSyncAt === 'number' ? r.lastSyncAt : undefined,
  }
}

export async function saveWebDAVConfig(config: WebDAVConfig): Promise<void> {
  await settingsRepository.set(WEBDAV_KEY, config)
}

export { BackupVersionError }
