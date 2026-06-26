import { SCHEMA_VERSION } from './dexie';

export { SCHEMA_VERSION };

export interface MigrationContext {
  fromVersion: number;
  toVersion: number;
}

export async function runMigrations(): Promise<void> {
  // Dexie handles schema migrations automatically via db.version()
  // This module is reserved for future data migration logic
  // e.g., transforming documents when schema fields change
  void SCHEMA_VERSION;
}
