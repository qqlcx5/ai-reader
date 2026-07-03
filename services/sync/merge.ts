import type { VersionMap, SyncConflictItem, ConflictResolution, SyncChangeItem, EntityKey } from '@/types/sync'

export interface VersionedEntry {
  entity: any
  version: string
}

export interface MergeInput {
  local: Map<string, VersionedEntry>
  remote: Map<string, VersionedEntry>
  base: VersionMap
  /** How to resolve conflicts where both sides changed since base. */
  resolution?: ConflictResolution
}

export interface MergeStats {
  pulled: number
  pushed: number
  deletedLocal: number
  deletedRemote: number
  conflicts: number
}

export interface MergeOutput {
  /** The converged set: what both local and remote should hold after sync. */
  merged: Map<string, any>
  /** ids present locally but not in the merged set (remote-deleted) → remove locally. */
  localDeletes: string[]
  /** ids present remotely but dropped from the merged set (local-deleted) → drop from remote. */
  remoteDeletes: string[]
  /** New base versions (versions of the merged set). */
  newBase: VersionMap
  stats: MergeStats
  /** Details of each conflicting item. */
  conflicts: Array<{ id: string; localVersion: string; remoteVersion: string; chosen: 'local' | 'remote' }>
  /** ids that were pulled. */
  pulledIds: string[]
  /** ids that were pushed. */
  pushedIds: string[]
}

/**
 * Three-way merge for one entity type, Remotely-Save-style:
 *   - both present → last-write-wins by version (or per resolution strategy)
 *   - local-only & in base → remote deleted it → delete locally
 *   - remote-only & in base → local deleted it → drop from remote
 *   - local-only & not in base → new locally → push
 *   - remote-only & not in base → new remotely → pull
 *   - neither & in base → already gone both sides → drop from base
 *
 * "version" is a comparable string (ISO updatedAt / addedAt); later wins.
 * `resolution` controls how real conflicts (both sides changed) are merged.
 */
export function mergeSet(input: MergeInput): MergeOutput {
  const { local: L, remote: R, base: B, resolution = 'lww' } = input
  const merged = new Map<string, any>()
  const localDeletes: string[] = []
  const remoteDeletes: string[] = []
  const newBase: VersionMap = {}
  const stats: MergeStats = { pulled: 0, pushed: 0, deletedLocal: 0, deletedRemote: 0, conflicts: 0 }
  const conflictDetails: MergeOutput['conflicts'] = []
  const pulledIds: string[] = []
  const pushedIds: string[] = []

  const ids = new Set<string>([...L.keys(), ...R.keys(), ...Object.keys(B)])
  for (const id of ids) {
    const l = L.get(id)
    const r = R.get(id)
    const bVer = B[id]
    const lVer = l?.version ?? ''
    const rVer = r?.version ?? ''

    if (l && r) {
      const lChanged = lVer !== bVer
      const rChanged = rVer !== bVer
      const isConflict = lChanged && rChanged && lVer !== rVer

      let chosen: typeof l | typeof r
      let chosenSide: 'local' | 'remote'

      if (isConflict) {
        if (resolution === 'local') {
          chosen = l
          chosenSide = 'local'
        } else if (resolution === 'remote') {
          chosen = r
          chosenSide = 'remote'
        } else {
          // LWW: later version wins, local wins ties
          chosenSide = lVer >= rVer ? 'local' : 'remote'
          chosen = chosenSide === 'local' ? l : r
        }
        stats.conflicts++
        conflictDetails.push({ id, localVersion: lVer, remoteVersion: rVer, chosen: chosenSide })
      } else {
        // One-sided change or no change
        const localNewer = lVer >= rVer
        chosen = localNewer ? l : r
        chosenSide = localNewer ? 'local' : 'remote'
      }

      if (lVer !== rVer) {
        if (chosenSide === 'local') { stats.pushed++; pushedIds.push(id) }
        else { stats.pulled++; pulledIds.push(id) }
      }
      merged.set(id, chosen.entity)
      newBase[id] = chosen.version
    } else if (l && !r) {
      if (bVer !== undefined) {
        localDeletes.push(id)
        stats.deletedLocal++
      } else {
        merged.set(id, l.entity)
        newBase[id] = l.version
        stats.pushed++
        pushedIds.push(id)
      }
    } else if (!l && r) {
      if (bVer !== undefined) {
        // local deletion propagates to remote: simply exclude from merged.
        remoteDeletes.push(id)
        stats.deletedRemote++
      } else {
        merged.set(id, r.entity)
        newBase[id] = r.version
        stats.pulled++
        pulledIds.push(id)
      }
    }
    // else: absent on both sides → drop from base (omit from newBase)
  }

  return { merged, localDeletes, remoteDeletes, newBase, stats, conflicts: conflictDetails, pulledIds, pushedIds }
}
