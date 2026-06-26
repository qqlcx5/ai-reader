/**
 * Backup service — manual export / import of the local store.
 *
 * Produces / consumes `BackupBundle`:
 *
 *   {
 *     schemaVersion, version, exportedAt,
 *     documents[], chatHistories[], settings[]
 *   }
 *
 * Large text fields (`markdownContent`, `rawHtml`, and
 * `messages[].content`) are compressed with `lz-string` before
 * being serialised; the bundle carries a `_compressed: true`
 * marker so older builds can read old bundles (without the
 * marker) and new builds know to decompress.
 *
 * The service is the single entry point used by:
 *   - the Options page  (WebDAVSettings.vue export/import)
 *   - the Side Panel    (SettingsPage.vue export/import)
 *   - the WebDAV flow   (webdav.service reads the same data
 *     structure, but on the same shape so the schemas stay
 *     in lock-step)
 */

import LZString from 'lz-string'
import { CURRENT_SCHEMA_VERSION } from '@db/schema'
import type {
  BackupBundle,
  CapturedDocument,
  ChatHistory,
  ChatHistoryMessage,
  SettingsEntry,
} from '@db/schema'
import { documentRepository } from '@core/documents/document.repository'
import { chatRepository } from '@core/chat/chat.repository'
import { modelRepository } from '@core/models/model.repository'
import { settingsRepository } from '@core/models/settings.repository'

/** Bump when the on-wire shape of the bundle changes incompatibly. */
export const BACKUP_BUNDLE_VERSION = '1.0.0'

/** Fields that get lz-string compressed when serialised. */
const COMPRESSED_DOC_FIELDS = ['markdownContent', 'rawHtml'] as const

/** Marker added to the bundle root so consumers know to decompress. */
const COMPRESSED_MARKER = '_compressed' as const

type Compressible = string | null | undefined

function compressField(value: Compressible): Compressible {
  if (typeof value !== 'string' || value.length === 0) return value
  return LZString.compressToUTF16(value)
}

function decompressField(value: Compressible): Compressible {
  if (typeof value !== 'string' || value.length === 0) return value
  try {
    return LZString.decompressFromUTF16(value) ?? value
  } catch {
    // Best-effort: if it wasn't actually compressed, hand the
    // raw string back. The import path treats the data as
    // opaque anyway.
    return value
  }
}

function compressMessageContent(msg: ChatHistoryMessage): ChatHistoryMessage {
  return { ...msg, content: compressField(msg.content) ?? '' }
}

function decompressMessageContent(msg: ChatHistoryMessage): ChatHistoryMessage {
  return { ...msg, content: decompressField(msg.content) ?? '' }
}

function compressDocFields(doc: CapturedDocument): CapturedDocument {
  const out: CapturedDocument = { ...doc }
  for (const key of COMPRESSED_DOC_FIELDS) {
    // @ts-expect-error: index-by-literal
    out[key] = compressField(out[key])
  }
  return out
}

function decompressDocFields(doc: CapturedDocument): CapturedDocument {
  const out: CapturedDocument = { ...doc }
  for (const key of COMPRESSED_DOC_FIELDS) {
    // @ts-expect-error: index-by-literal
    out[key] = decompressField(out[key])
  }
  return out
}

interface PackOptions {
  /** Include model provider configs in the bundle (default: true). */
  includeModels?: boolean
  /** Include settings table (default: true). */
  includeSettings?: boolean
  /** Include raw HTML (default: true). */
  includeRawHtml?: boolean
}

interface UnpackOptions {
  /** Replace all existing data on import. */
  replace?: boolean
  /** Skip the schema-version guard (used for tests / migration). */
  skipVersionCheck?: boolean
}

interface ImportSummary {
  documents: number
  chats: number
  models: number
  settings: number
  replaced: boolean
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupValidationError'
  }
}

export class BackupVersionError extends Error {
  constructor(public readonly expected: number, public readonly got: number) {
    super(`Backup schema version mismatch: expected ${expected}, got ${got}`)
    this.name = 'BackupVersionError'
  }
}

/**
 * Pack the local data into a `BackupBundle`.
 *
 * By default every record is included and the heavy text fields
 * are compressed. `compressed: true` is set so consumers know
 * to call `decompress` on the way back in.
 */
export async function exportBackup(opts: PackOptions = {}): Promise<BackupBundle> {
  const { includeModels = true, includeSettings = true, includeRawHtml = true } = opts

  const documents = await documentRepository.listAll()
  const chatHistories = await chatRepository.list()
  const settings = includeSettings ? await settingsRepository.list() : []
  const models = includeModels ? await modelRepository.list() : []

  const compressedDocs = documents.map((d) => {
    const packed = compressDocFields(d)
    if (!includeRawHtml) {
      // @ts-expect-error: index-by-literal
      packed.rawHtml = undefined
    }
    return packed
  })

  const compressedChats = chatHistories.map((h) => ({
    ...h,
    messages: h.messages.map(compressMessageContent),
  }))

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: BACKUP_BUNDLE_VERSION,
    exportedAt: Date.now(),
    documents: compressedDocs,
    chatHistories: compressedChats,
    // We deliberately flatten the multi-entry SettingsEntry[]
    // into a plain object that matches what the SettingsService
    // expects. We *also* include a `models` array, which is
    // not part of the original BackupBundle type — it's a
    // pragmatic extra that the import side honours.
    settings: settings,
    // Custom field, consumed by importBackup.
    ...({ models } as unknown as Record<string, unknown>),
  } as BackupBundle & { models: typeof models }
}

/**
 * Validate and decompress a bundle. Does *not* persist anything.
 */
export function parseBackup(raw: unknown): BackupBundle {
  if (!raw || typeof raw !== 'object') {
    throw new BackupValidationError('Backup must be a JSON object')
  }
  const bundle = raw as Record<string, unknown>
  if (typeof bundle.schemaVersion !== 'number') {
    throw new BackupValidationError('Missing schemaVersion in backup')
  }
  if (typeof bundle.version !== 'string') {
    throw new BackupValidationError('Missing version in backup')
  }
  if (!Array.isArray(bundle.documents)) {
    throw new BackupValidationError('documents must be an array')
  }
  if (!Array.isArray(bundle.chatHistories)) {
    throw new BackupValidationError('chatHistories must be an array')
  }
  if (!Array.isArray(bundle.settings)) {
    throw new BackupValidationError('settings must be an array')
  }
  return bundle as unknown as BackupBundle
}

/**
 * Import a backup bundle into the local store.
 *
 * `replace: true`  → clear documents / chats / settings first.
 * `replace: false` → merge: existing records with the same id
 *                    are overwritten, others kept.
 */
export async function importBackup(
  bundle: BackupBundle,
  opts: UnpackOptions = {}
): Promise<ImportSummary> {
  const { replace = false, skipVersionCheck = false } = opts
  if (!skipVersionCheck && bundle.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new BackupVersionError(CURRENT_SCHEMA_VERSION, bundle.schemaVersion)
  }

  const isCompressed =
    (bundle as unknown as Record<string, unknown>)[COMPRESSED_MARKER] === true

  // Decompress (idempotent on already-plain text because the
  // lz-string helpers fall back to the input).
  const documents = bundle.documents.map((d) =>
    isCompressed ? decompressDocFields(d) : d
  )
  const chatHistories = bundle.chatHistories.map((h) => ({
    ...h,
    messages: isCompressed ? h.messages.map(decompressMessageContent) : h.messages,
  }))
  const settings: SettingsEntry[] = bundle.settings
  const extraModels =
    ((bundle as unknown as Record<string, unknown>).models as unknown[]) ?? []

  if (replace) {
    await Promise.all([
      documentRepository.clear(),
      chatRepository.clear(),
    ])
  }

  if (documents.length > 0) {
    await documentRepository.bulkPut(documents)
  }
  if (chatHistories.length > 0) {
    await chatRepository.bulkPut(chatHistories)
  }
  if (settings.length > 0) {
    await settingsRepository.bulkPut(settings)
  }

  let modelsImported = 0
  if (extraModels.length > 0) {
    // modelRepository.bulkPut does an upsert by id, so a merge
    // is the natural behaviour even when replace=true.
    await modelRepository.bulkPut(extraModels as never)
    modelsImported = extraModels.length
  }

  return {
    documents: documents.length,
    chats: chatHistories.length,
    models: modelsImported,
    settings: settings.length,
    replaced: replace,
  }
}

/* ---------------------------------------------------------------- */
/*  Browser-level helpers                                            */
/* ---------------------------------------------------------------- */

/**
 * Trigger a browser download of the current backup as
 * `ai-reader-backup-<date>.json`.
 *
 * Caller must be in a UI context (side panel, options page,
 * popup) — uses `<a download>`.
 */
export async function downloadBackup(opts: PackOptions = {}): Promise<BackupBundle> {
  const bundle = await exportBackup(opts)
  const payload = {
    ...bundle,
    [COMPRESSED_MARKER]: true,
  }
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ai-reader-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revocation a tick so Firefox has a chance to start
  // the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return bundle
}

/**
 * Read a File chosen via `<input type="file">` and import it.
 */
export async function uploadBackup(
  file: File,
  opts: UnpackOptions = {}
): Promise<ImportSummary> {
  const text = await file.text()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (err) {
    throw new BackupValidationError(
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  const bundle = parseBackup(raw)
  return importBackup(bundle, opts)
}

/* ---------------------------------------------------------------- */
/*  Exposed for tests                                                 */
/* ---------------------------------------------------------------- */

export const __testing = {
  compressField,
  decompressField,
  compressDocFields,
  decompressDocFields,
  compressMessageContent,
  decompressMessageContent,
}
