import type { VersionMap } from '@/types/sync'

export interface VersionedEntry {
  entity: any
  version: string
}

export interface MergeInput {
  local: Map<string, VersionedEntry>
  remote: Map<string, VersionedEntry>
  base: VersionMap
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
}

/**
 * Three-way merge for one entity type, Remotely-Save-style:
 *   - both present → last-write-wins by version (local wins ties)
 *   - local-only & in base → remote deleted it → delete locally
 *   - remote-only & in base → local deleted it → drop from remote
 *   - local-only & not in base → new locally → push
 *   - remote-only & not in base → new remotely → pull
 *   - neither & in base → already gone both sides → drop from base
 *
 * "version" is a comparable string (ISO updatedAt / addedAt); later wins.
 */
export function mergeSet(input: MergeInput): MergeOutput {
  const { local: L, remote: R, base: B } = input
  const merged = new Map<string, any>()
  const localDeletes: string[] = []
  const remoteDeletes: string[] = []
  const newBase: VersionMap = {}
  const stats: MergeStats = { pulled: 0, pushed: 0, deletedLocal: 0, deletedRemote: 0, conflicts: 0 }

  const ids = new Set<string>([...L.keys(), ...R.keys(), ...Object.keys(B)])
  for (const id of ids) {
    const l = L.get(id)
    const r = R.get(id)
    const bVer = B[id]
    const lVer = l?.version ?? ''
    const rVer = r?.version ?? ''

    if (l && r) {
      const localNewer = lVer >= rVer
      const chosen = localNewer ? l : r
      if (lVer !== rVer) {
        // Divergence since base on both sides = a real conflict; otherwise one-sided change.
        const lChanged = lVer !== bVer
        const rChanged = rVer !== bVer
        if (lChanged && rChanged) stats.conflicts++
        if (localNewer) stats.pushed++
        else stats.pulled++
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
      }
    }
    // else: absent on both sides → drop from base (omit from newBase)
  }

  return { merged, localDeletes, remoteDeletes, newBase, stats }
}
