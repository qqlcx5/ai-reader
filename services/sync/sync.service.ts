import { db } from '@/db'
import { MetaRepository } from '@/db/repositories/meta.repository'
import { mergeSet, type VersionedEntry } from './merge'
import { createWebDAVRemote, normalizeBasePath, type WebDAVRemote } from '../webdav/webdav.client'
import type {
  WebDAVConfig,
  SyncState,
  SyncedDataset,
  RemoteSnapshot,
  SyncVersions,
  EntityKey,
  SyncResult,
  SyncPreview,
  SyncDeleteItem,
} from '@/types/sync'

const DATA_FILE = 'data.json'
const BACKUP_FILE = 'data.backup.json'
const SYNC_VERSION = 1
const SYNC_STATE_ID = 'sync-state'
// Abort when a sync would delete a large fraction of one side — almost always
// an emptied remote/local (or wrong account), never a real bulk delete.
const SAFEGUARD_MIN = 5
const SAFEGUARD_RATIO = 0.5

interface TypeConfig {
  type: EntityKey
  table: () => any
  version: (e: any) => string
  filter?: (e: any) => boolean
  /** Natural key for dedupe (defaults to e.id). */
  natKey?: (e: any) => string
  /** Apply by clearing the table and putting the whole merged set (junction tables). */
  rebuild?: boolean
}

const TYPE_CONFIGS: TypeConfig[] = [
  { type: 'documents', table: () => db.documents, version: (e) => e.updatedAt },
  { type: 'conversations', table: () => db.conversations, version: (e) => e.updatedAt },
  { type: 'models', table: () => db.models, version: (e) => e.updatedAt },
  { type: 'collections', table: () => db.collections, version: (e) => e.updatedAt },
  {
    type: 'collectionItems',
    table: () => db.collectionItems,
    version: (e) => e.addedAt,
    // Natural key is the membership pair, not the per-device uuid id, so the same
    // pair added on two devices collapses to one entry instead of duplicating.
    natKey: (e) => `${e.collectionId}/${e.documentId}`,
    rebuild: true,
  },
  {
    type: 'settings',
    table: () => db.settings,
    version: (e) => e.updatedAt,
    filter: (e) => e.id === 'app-settings',
  },
  // RSS subscriptions sync across devices; feedItems are deliberately excluded
  // (they're a local, re-fetched cache — see feeds/refresh.ts).
  { type: 'feeds', table: () => db.feeds, version: (e) => e.updatedAt },
]

function emptyVersions(): SyncVersions {
  return { documents: {}, conversations: {}, models: {}, collections: {}, collectionItems: {}, settings: {}, feeds: {} }
}

function emptyDataset(): SyncedDataset {
  return { documents: [], conversations: [], models: [], collections: [], collectionItems: [], settings: [], feeds: [] }
}

/** Strip raw text fields before uploading — raw HTML / rawText are not part of
 *  the backup. The Raw view falls back to markdown when rawText is absent. */
function stripRawFields(doc: any): any {
  if (!doc) return doc
  const { rawHtml, rawHtmlCompressed, rawText, ...rest } = doc
  return rest
}

function toMap(arr: any[] | undefined, cfg: TypeConfig): Map<string, VersionedEntry> {
  const map = new Map<string, VersionedEntry>()
  for (const e of arr ?? []) {
    if (cfg.filter && !cfg.filter(e)) continue
    const k = cfg.natKey ? cfg.natKey(e) : e.id
    map.set(k, { entity: e, version: cfg.version(e) ?? '' })
  }
  return map
}

function labelFor(type: EntityKey, e: any): string | undefined {
  switch (type) {
    case 'documents':
      return e.title || e.url
    case 'conversations':
      return e.title || '新对话'
    case 'collections':
      return e.name
    case 'models':
      return e.name
    case 'feeds':
      return e.title || e.url
    default:
      return undefined
  }
}

function isBigDelete(deleted: number, total: number): boolean {
  return deleted >= SAFEGUARD_MIN && total > 0 && deleted > total * SAFEGUARD_RATIO
}

function baseFromDataset(data: SyncedDataset): SyncVersions {
  const base = emptyVersions()
  for (const cfg2 of TYPE_CONFIGS) {
    for (const [k, v] of toMap(data[cfg2.type], cfg2)) base[cfg2.type][k] = v.version
  }
  return base
}

async function loadSyncState(): Promise<SyncState> {
  return (await MetaRepository.get<SyncState>(SYNC_STATE_ID)) ?? { id: 'sync-state', lastSyncAt: '', base: emptyVersions() }
}

export async function getSyncState(): Promise<SyncState | undefined> {
  return MetaRepository.get<SyncState>(SYNC_STATE_ID)
}

export async function testConnection(cfg: WebDAVConfig) {
  return createWebDAVRemote({ ...cfg, basePath: normalizeBasePath(cfg.basePath) }).test()
}

/** Overwrite local tables with a dataset and reset the base to match it. */
async function applyDatasetAndResetBase(data: SyncedDataset): Promise<void> {
  for (const cfg2 of TYPE_CONFIGS) {
    const arr = cfg2.filter ? (data[cfg2.type] ?? []).filter(cfg2.filter) : data[cfg2.type] ?? []
    await db.transaction('rw', cfg2.table(), async () => {
      await cfg2.table().clear()
      if (arr.length) await cfg2.table().bulkPut(arr)
    })
  }
  await MetaRepository.set(SYNC_STATE_ID, {
    id: 'sync-state',
    lastSyncAt: new Date().toISOString(),
    base: baseFromDataset(data),
  } satisfies SyncState)
}

/**
 * Force (full) upload: overwrite the remote snapshot with the entire local
 * dataset and reset the base to match, so local == remote == base afterwards.
 * Clobbers any remote state. Use as a manual override when merge is unwanted.
 */
export async function forceUpload(rawCfg: WebDAVConfig): Promise<void> {
  const cfg: WebDAVConfig = { ...rawCfg, basePath: normalizeBasePath(rawCfg.basePath) }
  const remote = createWebDAVRemote(cfg)

  const test = await remote.test()
  if (!test.ok) throw new Error(test.error || 'WebDAV 连接失败')

  const data: SyncedDataset = {
    documents: (await db.documents.toArray()).map(stripRawFields),
    conversations: await db.conversations.toArray(),
    models: await db.models.toArray(),
    collections: await db.collections.toArray(),
    collectionItems: await db.collectionItems.toArray(),
    settings: (await db.settings.toArray()).filter((s) => s.id === 'app-settings'),
    feeds: await db.feeds.toArray(),
  }

  await remote.putText(
    DATA_FILE,
    JSON.stringify({ version: SYNC_VERSION, syncedAt: new Date().toISOString(), data } satisfies RemoteSnapshot),
  )

  await MetaRepository.set(SYNC_STATE_ID, {
    id: 'sync-state',
    lastSyncAt: new Date().toISOString(),
    base: baseFromDataset(data),
  } satisfies SyncState)
}

/**
 * Force (full) download: overwrite local data with the entire remote snapshot
 * and reset the base to match. Clobbers any local state. Use as a manual
 * override (e.g. after the wipe-safeguard aborts, to declare remote the truth).
 */
export async function forceDownload(rawCfg: WebDAVConfig): Promise<void> {
  const cfg: WebDAVConfig = { ...rawCfg, basePath: normalizeBasePath(rawCfg.basePath) }
  const remote = createWebDAVRemote(cfg)

  const test = await remote.test()
  if (!test.ok) throw new Error(test.error || 'WebDAV 连接失败')
  if (!(await remote.hasData())) throw new Error('远端没有数据可下载')

  const snap = JSON.parse(await remote.getText(DATA_FILE)) as RemoteSnapshot
  await applyDatasetAndResetBase(snap.data ?? emptyDataset())
}

/**
 * Restore the last pre-sync remote backup (`data.backup.json`): promote it to
 * `data.json` and mirror it to local. One-step rollback after a bad sync.
 */
export async function restoreFromBackup(rawCfg: WebDAVConfig): Promise<void> {
  const cfg: WebDAVConfig = { ...rawCfg, basePath: normalizeBasePath(rawCfg.basePath) }
  const remote = createWebDAVRemote(cfg)

  const test = await remote.test()
  if (!test.ok) throw new Error(test.error || 'WebDAV 连接失败')

  let raw: string
  try {
    raw = await remote.getText(BACKUP_FILE)
  } catch {
    throw new Error('没有可恢复的备份（data.backup.json 不存在）')
  }

  // Promote backup to current remote, then mirror onto local.
  await remote.putText(DATA_FILE, raw)
  const snap = JSON.parse(raw) as RemoteSnapshot
  await applyDatasetAndResetBase(snap.data ?? emptyDataset())
}

interface Computed {
  mergedDataset: SyncedDataset
  newBase: SyncVersions
  puts: Record<EntityKey, any[]>
  deletes: Record<EntityKey, string[]>
  result: SyncResult
  localTotal: number
  remoteTotal: number
  localDeleteItems: SyncDeleteItem[]
  remoteDeleteItems: SyncDeleteItem[]
  abortReason?: string
  prevRemoteRaw: string | null
}

/** Pull remote + load base + merge every type. Pure compute — writes nothing. */
async function computeMerge(remote: WebDAVRemote): Promise<Computed> {
  const remoteData: SyncedDataset = emptyDataset()
  let prevRemoteRaw: string | null = null
  if (await remote.hasData()) {
    try {
      prevRemoteRaw = await remote.getText(DATA_FILE)
      const snap = JSON.parse(prevRemoteRaw) as RemoteSnapshot
      if (snap?.data) Object.assign(remoteData, snap.data)
    } catch {
      prevRemoteRaw = null
    }
  }

  const state = await loadSyncState()
  const result: SyncResult = { pulled: 0, pushed: 0, deletedLocal: 0, deletedRemote: 0, conflicts: 0 }
  const mergedDataset = emptyDataset()
  const newBase = emptyVersions()
  const puts: Record<EntityKey, any[]> = { ...emptyDataset() }
  const deletes: Record<EntityKey, string[]> = { documents: [], conversations: [], models: [], collections: [], collectionItems: [], settings: [], feeds: [] }
  const localDeleteItems: SyncDeleteItem[] = []
  const remoteDeleteItems: SyncDeleteItem[] = []

  let localTotal = 0
  let remoteTotal = 0

  for (const cfg2 of TYPE_CONFIGS) {
    const localMap = toMap(await cfg2.table().toArray(), cfg2)
    localTotal += localMap.size
    const remoteMap = toMap(remoteData[cfg2.type], cfg2)
    remoteTotal += remoteMap.size
    const out = mergeSet({ local: localMap, remote: remoteMap, base: state.base[cfg2.type] ?? {} })

    const mergedEntities = [...out.merged.values()]
    ;(mergedDataset[cfg2.type] as any[]).push(...mergedEntities)
    newBase[cfg2.type] = out.newBase

    if (cfg2.rebuild) {
      puts[cfg2.type] = mergedEntities
    } else {
      // Only write entities whose version differs from current local (or are new).
      puts[cfg2.type] = mergedEntities.filter((e) => {
        const k = cfg2.natKey ? cfg2.natKey(e) : e.id
        const cur = localMap.get(k)
        return !cur || cur.version !== (cfg2.version(e) ?? '')
      })
      deletes[cfg2.type] = out.localDeletes
    }

    // Collect labelled delete items for the preview (skip noisy junction/settings).
    if (cfg2.type !== 'collectionItems' && cfg2.type !== 'settings') {
      for (const id of out.localDeletes) {
        const e = localMap.get(id)?.entity
        localDeleteItems.push({ type: cfg2.type, id, label: e ? labelFor(cfg2.type, e) : undefined })
      }
      for (const id of out.remoteDeletes) {
        const e = remoteMap.get(id)?.entity
        remoteDeleteItems.push({ type: cfg2.type, id, label: e ? labelFor(cfg2.type, e) : undefined })
      }
    }

    result.pulled += out.stats.pulled
    result.pushed += out.stats.pushed
    result.deletedLocal += out.stats.deletedLocal
    result.deletedRemote += out.stats.deletedRemote
    result.conflicts += out.stats.conflicts
  }

  let abortReason: string | undefined
  if (isBigDelete(result.deletedLocal, localTotal)) {
    abortReason =
      `同步已中止：本次将删除本地 ${result.deletedLocal}/${localTotal} 条数据，疑似远端被清空。` +
      `若要以本地为准请用「全量上传」，以远端为准请用「全量下载」。`
  } else if (isBigDelete(result.deletedRemote, remoteTotal)) {
    abortReason =
      `同步已中止：本次将删除远端 ${result.deletedRemote}/${remoteTotal} 条数据，疑似本地被清空。` +
      `若要以本地为准请用「全量上传」，以远端为准请用「全量下载」。`
  }

  return {
    mergedDataset,
    newBase,
    puts,
    deletes,
    result,
    localTotal,
    remoteTotal,
    localDeleteItems,
    remoteDeleteItems,
    abortReason,
    prevRemoteRaw,
  }
}

/** Dry-run: compute what a sync would do without writing anything. */
export async function previewSync(rawCfg: WebDAVConfig): Promise<SyncPreview> {
  const cfg: WebDAVConfig = { ...rawCfg, basePath: normalizeBasePath(rawCfg.basePath) }
  const remote = createWebDAVRemote(cfg)

  const test = await remote.test()
  if (!test.ok) throw new Error(test.error || 'WebDAV 连接失败')

  const c = await computeMerge(remote)
  return {
    pulled: c.result.pulled,
    pushed: c.result.pushed,
    deletedLocal: c.result.deletedLocal,
    deletedRemote: c.result.deletedRemote,
    conflicts: c.result.conflicts,
    localTotal: c.localTotal,
    remoteTotal: c.remoteTotal,
    abortReason: c.abortReason,
    localDeleteItems: c.localDeleteItems,
    remoteDeleteItems: c.remoteDeleteItems,
  }
}

export async function runSync(rawCfg: WebDAVConfig): Promise<SyncResult> {
  const cfg: WebDAVConfig = { ...rawCfg, basePath: normalizeBasePath(rawCfg.basePath) }
  const remote = createWebDAVRemote(cfg)

  const test = await remote.test()
  if (!test.ok) throw new Error(test.error || 'WebDAV 连接失败')

  const c = await computeMerge(remote)
  if (c.abortReason) throw new Error(c.abortReason)

  // 1. Apply locally.
  for (const cfg2 of TYPE_CONFIGS) {
    const table = cfg2.table()
    const p = c.puts[cfg2.type]
    const d = c.deletes[cfg2.type]
    if (p.length === 0 && d.length === 0) continue
    await db.transaction('rw', table, async () => {
      if (cfg2.rebuild) {
        await table.clear()
      } else {
        for (const id of d) await table.delete(id)
      }
      if (p.length) await table.bulkPut(p)
    })
  }

  // 2. Back up the previous remote snapshot before overwriting (one-step rollback).
  if (c.prevRemoteRaw != null) {
    try {
      await remote.putText(BACKUP_FILE, c.prevRemoteRaw)
    } catch {
      // best-effort — sync still succeeds without a fresh backup
    }
  }

  // 3. Push merged snapshot (raw HTML excluded from the backup).
  const snapshot: RemoteSnapshot = {
    version: SYNC_VERSION,
    syncedAt: new Date().toISOString(),
    data: { ...c.mergedDataset, documents: c.mergedDataset.documents.map(stripRawFields) },
  }
  await remote.putText(DATA_FILE, JSON.stringify(snapshot))

  // 4. Update device-local sync state.
  await MetaRepository.set(SYNC_STATE_ID, {
    id: 'sync-state',
    lastSyncAt: new Date().toISOString(),
    base: c.newBase,
  } satisfies SyncState)

  return c.result
}
