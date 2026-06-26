/**
 * Migration scaffolding.
 *
 * Each `version(N)` block in `db/dexie.ts` is itself a migration
 * step. Helpers here exist so that future version bumps have a
 * consistent place to put data-shaping logic.
 *
 * Pattern for future upgrades (illustrative — not yet needed at v1):
 *
 *   db.version(2).stores({...}).upgrade(async (tx) => {
 *     await tx.table('documents').toCollection().modify((doc) => {
 *       doc.schemaVersion = 2
 *     })
 *   })
 */

import { CURRENT_SCHEMA_VERSION } from './schema'

export { CURRENT_SCHEMA_VERSION }

export interface MigrationStep {
  from: number
  to: number
  description: string
}

/**
 * Ordered list of past migrations, used by tooling to decide
 * whether an imported backup is compatible with the running build.
 */
export const migrationHistory: MigrationStep[] = [
  { from: 0, to: 1, description: 'Initial schema (documents, chatHistories, settings)' },
]
