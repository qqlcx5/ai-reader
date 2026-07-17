import dayjs from 'dayjs'
import { db } from '@/db'
import { MetaRepository } from '@/db/repositories/meta.repository'
import { refreshAfterDataChange } from '@/services/sync/refresh'
import { mergeSet, type VersionedEntry } from './merge'
import type {
  SyncState,
  SyncedDataset,
  RemoteSnapshot,
  SyncVersions,
  EntityKey,
  SyncResult,
  SyncPreview,
  SyncDeleteItem,
  SyncConflictItem,
  SyncChangeItem,
  ConflictResolution,
  BackupEntry,
} from '@/types/sync'

// ── RemoteTransport ────────────────────────────────────────────────────────
/** Protocol-agnostic remote transport that sync.service orchestrates against.
 *  Implementations: WebDAV (services/webdav/webdav.client.ts),
 *  S3 (services/s3/s3.client.ts). */
export interface RemoteTransport {
  test(): Promise<{ ok: boolean; error?: string }>
  hasData(): Promise<boolean>
  putText(path: string, text: string): Promise<void>
  getText(path: string): Promise<string>
  remove(path: string): Promise<void>
  /** Names of files in the base directory (best-effort, never throws). */
  listFiles(): Promise<string[]>
}

// ── Constants ──────────────────────────────────────────────────────────────
const DATA_FILE = 'data.json'
const BACKUP_PREFIX = 'data.backup-'
const BACKUP_RE = /^data\.backup-(\d{8}T\d{9}Z)(?:-[0-9a-z]+)?\.json$/
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
  /** For tables shared across multiple EntityKey types (e.g., kvMeta):
   *  use targeted row deletes instead of table.clear(). */
  sharedTable?: boolean
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
    natKey: (e) => `${e.collectionId}/${e.documentId}`,
    rebuild: true,
  },
  {
    type: 'settings',
    table: () => db.settings,
    version: (e) => e.updatedAt,
    filter: (e) => e.id === 'app-settings',
  },
  { type: 'feeds', table: () => db.feeds, version: (e) => e.updatedAt },
  { type: 'promptTemplates', table: () => db.promptTemplates, version: (e) => e.updatedAt },
  {
    type: 'webdavConfig',
    table: () => db.kvMeta,
    version: (e) => e.updatedAt ?? '',
    filter: (e) => e.id === 'webdav-config',
    natKey: (e) => e.id,
    sharedTable: true,
  },
  {
    type: 's3Config',
    table: () => db.kvMeta,
    version: (e) => e.updatedAt ?? '',
    filter: (e) => e.id === 's3-config',
    natKey: (e) => e.id,
    sharedTable: true,
  },
]

function emptyVersions(): SyncVersions {
  return { documents: {}, conversations: {}, models: {}, collections: {}, collectionItems: {}, settings: {}, feeds: {}, promptTemplates: {}, webdavConfig: {}, s3Config: {} }
}

function emptyDataset(): SyncedDataset {
  return { documents: [], conversations: [], models: [], collections: [], collectionItems: [], settings: [], feeds: [], promptTemplates: [], webdavConfig: [], s3Config: [] }
}

function stripRawFields(doc: any): any {
  if (!doc) return doc
  const { rawHtml, rawHtmlCompressed, ...rest } = doc
  return rest
}

function utcStamp(date?: dayjs.ConfigType): string {
  return dayjs(date).toISOString().replace(/[-:.]/g, '')
}

function stampToDate(stamp: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z$/.exec(stamp)
  if (!m) return NaN
  return dayjs(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7]}Z`).valueOf()
}

function rand4(): string {
  return Math.random().toString(36).slice(2, 6).padEnd(4, '0')
}

async function pruneBackups(transport: RemoteTransport, max: number): Promise<void> {
  if (max < 0) return
  const names = (await transport.listFiles()).filter((n) => BACKUP_RE.test(n)).sort()
  const excess = names.slice(0, Math.max(0, names.length - max))
  for (const n of excess) await transport.remove(n)
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
      return e.title || (e.firstMessage ? (typeof e.firstMessage === 'string' ? e.firstMessage.slice(0, 30) : '新对话') : '新对话')
    case 'collections':
      return e.name
    case 'models':
      return e.name || e.id
    case 'feeds':
      return e.title || e.url
    case 'webdavConfig':
      return 'WebDAV 配置'
    case 's3Config':
      return 'S3 配置'
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

// ── Public API ─────────────────────────────────────────────────────────────

export async function testConnection(transport: RemoteTransport) {
  return transport.test()
}

async function applyDatasetAndResetBase(data: SyncedDataset): Promise<void> {
  for (const cfg2 of TYPE_CONFIGS) {
    const arr = cfg2.filter ? (data[cfg2.type] ?? []).filter(cfg2.filter) : data[cfg2.type] ?? []
    await db.transaction('rw', cfg2.table(), async () => {
      if (cfg2.sharedTable) {
        // Delete only rows matching this TypeConfig's filter (don't wipe shared table).
        const all = await cfg2.table().toArray()
        const toDelete = cfg2.filter ? all.filter(cfg2.filter) : all
        for (const row of toDelete) await cfg2.table().delete(row.id)
      } else {
        await cfg2.table().clear()
      }
      if (arr.length) await cfg2.table().bulkPut(arr)
    })
  }
  await MetaRepository.set(SYNC_STATE_ID, {
    id: 'sync-state',
    lastSyncAt: dayjs().toISOString(),
    base: baseFromDataset(data),
  } satisfies SyncState)
}

export async function forceUpload(transport: RemoteTransport): Promise<void> {
  const test = await transport.test()
  if (!test.ok) throw new Error(test.error || '远端连接失败')

  const data: SyncedDataset = {
    documents: (await db.documents.toArray()).map(stripRawFields),
    conversations: await db.conversations.toArray(),
    models: await db.models.toArray(),
    collections: await db.collections.toArray(),
    collectionItems: await db.collectionItems.toArray(),
    settings: (await db.settings.toArray()).filter((s) => s.id === 'app-settings'),
    feeds: await db.feeds.toArray(),
    promptTemplates: await db.promptTemplates.toArray(),
    webdavConfig: (await db.kvMeta.toArray()).filter((e) => e.id === 'webdav-config'),
    s3Config: (await db.kvMeta.toArray()).filter((e) => e.id === 's3-config'),
  }

  // NOTE: The sync data.json schema is incompatible with the export JSON schema.
  // These are two independent formats — do not cross-use sync files with export/import.
  await transport.putText(
    DATA_FILE,
    JSON.stringify({ version: SYNC_VERSION, syncedAt: dayjs().toISOString(), data } satisfies RemoteSnapshot),
  )

  await MetaRepository.set(SYNC_STATE_ID, {
    id: 'sync-state',
    lastSyncAt: dayjs().toISOString(),
    base: baseFromDataset(data),
  } satisfies SyncState)
}

export async function forceDownload(transport: RemoteTransport): Promise<void> {
  const test = await transport.test()
  if (!test.ok) throw new Error(test.error || '远端连接失败')
  if (!(await transport.hasData())) throw new Error('远端没有数据可下载')

  const snap = JSON.parse(await transport.getText(DATA_FILE)) as RemoteSnapshot
  await applyDatasetAndResetBase(snap.data ?? emptyDataset())
  await refreshAfterDataChange()
}

export async function restoreFromSnapshot(transport: RemoteTransport, name: string): Promise<void> {
  const test = await transport.test()
  if (!test.ok) throw new Error(test.error || '远端连接失败')

  let raw: string
  try {
    raw = await transport.getText(name)
  } catch {
    throw new Error(`备份 ${name} 不存在`)
  }

  await transport.putText(DATA_FILE, raw)
  const snap = JSON.parse(raw) as RemoteSnapshot
  await applyDatasetAndResetBase(snap.data ?? emptyDataset())
}

export async function listBackups(transport: RemoteTransport): Promise<BackupEntry[]> {
  const test = await transport.test()
  if (!test.ok) throw new Error(test.error || '远端连接失败')

  const names = (await transport.listFiles()).filter((n) => BACKUP_RE.test(n))
  return names
    .map((name) => {
      const m = BACKUP_RE.exec(name)
      const ts = m ? stampToDate(m[1]) : NaN
      return { name, ts: Number.isNaN(ts) ? 0 : ts }
    })
    .sort((a, b) => b.ts - a.ts)
}

// ── Internal merge engine ──────────────────────────────────────────────────

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
  conflictItems: SyncConflictItem[]
  pullItems: SyncChangeItem[]
  pushItems: SyncChangeItem[]
  abortReason?: string
  prevRemoteRaw: string | null
}

async function computeMerge(transport: RemoteTransport, resolution: ConflictResolution = 'lww'): Promise<Computed> {
  const remoteData: SyncedDataset = emptyDataset()
  let prevRemoteRaw: string | null = null
  if (await transport.hasData()) {
    try {
      prevRemoteRaw = await transport.getText(DATA_FILE)
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
  const deletes: Record<EntityKey, string[]> = {
    documents: [], conversations: [], models: [], collections: [], collectionItems: [], settings: [], feeds: [], promptTemplates: [], webdavConfig: [], s3Config: [],
  }
  const localDeleteItems: SyncDeleteItem[] = []
  const remoteDeleteItems: SyncDeleteItem[] = []
  const conflictItems: SyncConflictItem[] = []
  const pullItems: SyncChangeItem[] = []
  const pushItems: SyncChangeItem[] = []

  let localTotal = 0
  let remoteTotal = 0

  for (const cfg2 of TYPE_CONFIGS) {
    const localMap = toMap(await cfg2.table().toArray(), cfg2)
    localTotal += localMap.size
    const remoteMap = toMap(remoteData[cfg2.type], cfg2)
    remoteTotal += remoteMap.size
    const out = mergeSet({ local: localMap, remote: remoteMap, base: state.base[cfg2.type] ?? {}, resolution })

    const mergedEntities = [...out.merged.values()]
    ;(mergedDataset[cfg2.type] as any[]).push(...mergedEntities)
    newBase[cfg2.type] = out.newBase

    if (cfg2.rebuild) {
      puts[cfg2.type] = mergedEntities
    } else {
      puts[cfg2.type] = mergedEntities.filter((e) => {
        const k = cfg2.natKey ? cfg2.natKey(e) : e.id
        const cur = localMap.get(k)
        return !cur || cur.version !== (cfg2.version(e) ?? '')
      })
      deletes[cfg2.type] = out.localDeletes
    }

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

    // Collect conflict details
    for (const c of out.conflicts) {
      const localE = localMap.get(c.id)?.entity
      const remoteE = remoteMap.get(c.id)?.entity
      conflictItems.push({
        type: cfg2.type,
        id: c.id,
        label: (localE || remoteE) ? labelFor(cfg2.type, localE ?? remoteE) : undefined,
        localVersion: c.localVersion,
        remoteVersion: c.remoteVersion,
        chosen: c.chosen,
      })
    }

    // Collect pull/push detail items
    for (const id of out.pulledIds) {
      const e = remoteMap.get(id)?.entity
      pullItems.push({ type: cfg2.type, id, label: e ? labelFor(cfg2.type, e) : undefined })
    }
    for (const id of out.pushedIds) {
      const e = localMap.get(id)?.entity
      pushItems.push({ type: cfg2.type, id, label: e ? labelFor(cfg2.type, e) : undefined })
    }
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
    mergedDataset, newBase, puts, deletes, result,
    localTotal, remoteTotal, localDeleteItems, remoteDeleteItems,
    conflictItems, pullItems, pushItems,
    abortReason, prevRemoteRaw,
  }
}

export async function previewSync(transport: RemoteTransport, resolution: ConflictResolution = 'lww'): Promise<SyncPreview> {
  const test = await transport.test()
  if (!test.ok) throw new Error(test.error || '远端连接失败')

  const c = await computeMerge(transport, resolution)
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
    conflictItems: c.conflictItems,
    pullItems: c.pullItems,
    pushItems: c.pushItems,
    resolution,
  }
}

export async function runSync(transport: RemoteTransport, maxBackups = 10, resolution: ConflictResolution = 'lww'): Promise<SyncResult> {
  const test = await transport.test()
  if (!test.ok) throw new Error(test.error || '远端连接失败')

  const c = await computeMerge(transport, resolution)
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

  // 2. Build the merged snapshot.
  const newData = { ...c.mergedDataset, documents: c.mergedDataset.documents.map(stripRawFields) }
  const newJson = JSON.stringify({
    version: SYNC_VERSION,
    syncedAt: dayjs().toISOString(),
    data: newData,
  } satisfies RemoteSnapshot)

  // 3. Back up previous remote when data actually changed.
  let prevData: any = null
  if (c.prevRemoteRaw != null) {
    try {
      prevData = (JSON.parse(c.prevRemoteRaw) as RemoteSnapshot).data ?? null
    } catch {
      prevData = null
    }
  }
  if (c.prevRemoteRaw != null && JSON.stringify(prevData) !== JSON.stringify(newData)) {
    try {
      await transport.putText(`${BACKUP_PREFIX}${utcStamp()}-${rand4()}.json`, c.prevRemoteRaw)
      await pruneBackups(transport, maxBackups)
    } catch {
      // best-effort
    }
  }

  await transport.putText(DATA_FILE, newJson)

  // 4. Update device-local sync state.
  await MetaRepository.set(SYNC_STATE_ID, {
    id: 'sync-state',
    lastSyncAt: dayjs().toISOString(),
    base: c.newBase,
  } satisfies SyncState)

  await refreshAfterDataChange()
  return c.result
}
