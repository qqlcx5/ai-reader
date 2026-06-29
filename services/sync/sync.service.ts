import { db } from '@/db'
import { MetaRepository } from '@/db/repositories/meta.repository'
import { mergeSet, type VersionedEntry } from './merge'
import { createWebDAVRemote, normalizeBasePath } from '../webdav/webdav.client'
import type {
  WebDAVConfig,
  SyncState,
  SyncedDataset,
  RemoteSnapshot,
  SyncVersions,
  EntityKey,
  SyncResult,
} from '@/types/sync'

const DATA_FILE = 'data.json'
const SYNC_VERSION = 1
const SYNC_STATE_ID = 'sync-state'

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
]

function emptyVersions(): SyncVersions {
  return { documents: {}, conversations: {}, models: {}, collections: {}, collectionItems: {}, settings: {} }
}

function emptyDataset(): SyncedDataset {
  return { documents: [], conversations: [], models: [], collections: [], collectionItems: [], settings: [] }
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

async function loadSyncState(): Promise<SyncState> {
  return (await MetaRepository.get<SyncState>(SYNC_STATE_ID)) ?? { id: 'sync-state', lastSyncAt: '', base: emptyVersions() }
}

export async function getSyncState(): Promise<SyncState | undefined> {
  return MetaRepository.get<SyncState>(SYNC_STATE_ID)
}

export async function testConnection(cfg: WebDAVConfig) {
  return createWebDAVRemote({ ...cfg, basePath: normalizeBasePath(cfg.basePath) }).test()
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
    documents: await db.documents.toArray(),
    conversations: await db.conversations.toArray(),
    models: await db.models.toArray(),
    collections: await db.collections.toArray(),
    collectionItems: await db.collectionItems.toArray(),
    settings: (await db.settings.toArray()).filter((s) => s.id === 'app-settings'),
  }

  await remote.putText(
    DATA_FILE,
    JSON.stringify({ version: SYNC_VERSION, syncedAt: new Date().toISOString(), data } satisfies RemoteSnapshot),
  )

  // Reset base to this dataset so the next merge is consistent.
  const base: SyncVersions = emptyVersions()
  for (const cfg2 of TYPE_CONFIGS) {
    for (const [k, v] of toMap(data[cfg2.type], cfg2)) base[cfg2.type][k] = v.version
  }
  await MetaRepository.set(SYNC_STATE_ID, {
    id: 'sync-state',
    lastSyncAt: new Date().toISOString(),
    base,
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
  const data = snap.data ?? emptyDataset()

  for (const cfg2 of TYPE_CONFIGS) {
    const arr = cfg2.filter ? (data[cfg2.type] ?? []).filter(cfg2.filter) : data[cfg2.type] ?? []
    await db.transaction('rw', cfg2.table(), async () => {
      await cfg2.table().clear()
      if (arr.length) await cfg2.table().bulkPut(arr)
    })
  }

  // Reset base to the remote dataset so the next merge is consistent.
  const base: SyncVersions = emptyVersions()
  for (const cfg2 of TYPE_CONFIGS) {
    for (const [k, v] of toMap(data[cfg2.type], cfg2)) base[cfg2.type][k] = v.version
  }
  await MetaRepository.set(SYNC_STATE_ID, {
    id: 'sync-state',
    lastSyncAt: new Date().toISOString(),
    base,
  } satisfies SyncState)
}

export async function runSync(rawCfg: WebDAVConfig): Promise<SyncResult> {
  const cfg: WebDAVConfig = { ...rawCfg, basePath: normalizeBasePath(rawCfg.basePath) }
  const remote = createWebDAVRemote(cfg)

  const test = await remote.test()
  if (!test.ok) throw new Error(test.error || 'WebDAV 连接失败')

  // 1. Pull remote snapshot (empty if first push).
  const remoteData: SyncedDataset = emptyDataset()
  if (await remote.hasData()) {
    const snap = JSON.parse(await remote.getText(DATA_FILE)) as RemoteSnapshot
    if (snap?.data) Object.assign(remoteData, snap.data)
  }

  // 2. Load base + accumulator.
  const state = await loadSyncState()
  const result: SyncResult = { pulled: 0, pushed: 0, deletedLocal: 0, deletedRemote: 0, conflicts: 0 }
  const mergedDataset = emptyDataset()
  const newBase: SyncVersions = emptyVersions()
  const puts: Record<EntityKey, any[]> = { ...emptyDataset() }
  const deletes: Record<EntityKey, string[]> = { documents: [], conversations: [], models: [], collections: [], collectionItems: [], settings: [] }

  // 3. Merge each type.
  let localTotal = 0
  for (const cfg2 of TYPE_CONFIGS) {
    const localMap = toMap(await cfg2.table().toArray(), cfg2)
    localTotal += localMap.size
    const remoteMap = toMap(remoteData[cfg2.type], cfg2)
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

    result.pulled += out.stats.pulled
    result.pushed += out.stats.pushed
    result.deletedLocal += out.stats.deletedLocal
    result.deletedRemote += out.stats.deletedRemote
    result.conflicts += out.stats.conflicts
  }

  // Safeguard against accidental remote wipes: if this sync would delete a large
  // fraction of local data, it's almost certainly an emptied/missing remote (or
  // the wrong account) rather than a real bulk delete. Abort BEFORE writing
  // anything — local and remote are both left untouched. The user can override
  // with forceUpload (local wins) or forceDownload (remote wins).
  if (result.deletedLocal >= 5 && result.deletedLocal > localTotal * 0.5) {
    throw new Error(
      `同步已中止：本次将删除本地 ${result.deletedLocal}/${localTotal} 条数据，疑似远端被清空。` +
        `若要以本地为准请用「全量上传」，以远端为准请用「全量下载」。`,
    )
  }

  // 4. Apply locally.
  for (const cfg2 of TYPE_CONFIGS) {
    const table = cfg2.table()
    const p = puts[cfg2.type]
    const d = deletes[cfg2.type]
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

  // 5. Push merged snapshot.
  const snapshot: RemoteSnapshot = {
    version: SYNC_VERSION,
    syncedAt: new Date().toISOString(),
    data: mergedDataset,
  }
  await remote.putText(DATA_FILE, JSON.stringify(snapshot))

  // 6. Update device-local sync state.
  await MetaRepository.set(SYNC_STATE_ID, {
    id: 'sync-state',
    lastSyncAt: new Date().toISOString(),
    base: newBase,
  } satisfies SyncState)

  return result
}
