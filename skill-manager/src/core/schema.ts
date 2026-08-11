export type SkillSourceType = 'github' | 'local' | 'unknown'
export type MetadataGenerator = 'ai' | 'human' | 'unknown'
export type SyncStatus = 'up-to-date' | 'needs-review' | 'missing' | 'error'

export interface SkillSource {
  type: SkillSourceType
  repository?: string
  path?: string
  localPath: string
  version?: string
  hash?: string
}

export interface RawContentReference {
  path: string
  hash: string
  lastSyncedAt: string
}

export interface SkillMetadata {
  name: string
  summary: string
  categories: string[]
  useCases: string[]
  usage: string
  triggers: string[]
}

export interface MetadataStatus {
  generatedBy: MetadataGenerator
  reviewed: boolean
  lastGeneratedAt?: string
  lastReviewedAt?: string
  error?: string
}

export interface SkillPreferences {
  enabled: boolean
  favorite: boolean
}

export interface SkillSyncStatus {
  status: SyncStatus
  lastCheckedAt: string
}

export interface SkillRecord {
  id: string
  slug: string
  source?: SkillSource
  rawContent: RawContentReference
  metadata: SkillMetadata
  metadataStatus: MetadataStatus
  preferences: SkillPreferences
  sync: SkillSyncStatus
}

export interface SkillCatalog {
  schemaVersion: 1
  updatedAt: string
  skills: SkillRecord[]
}

export function assertCatalog(value: unknown): SkillCatalog {
  if (!isRecord(value)) {
    throw new Error('Catalog must be an object')
  }

  if (value.schemaVersion !== 1) {
    throw new Error('Unsupported catalog schema version')
  }

  if (typeof value.updatedAt !== 'string') {
    throw new Error('updatedAt must be a string')
  }

  if (!Array.isArray(value.skills)) {
    throw new Error('skills must be an array')
  }

  value.skills.forEach((skill, index) => assertSkillRecord(skill, index))
  return value as unknown as SkillCatalog
}

function assertSkillRecord(value: unknown, index: number): asserts value is SkillRecord {
  const prefix = `skills[${index}]`

  if (!isRecord(value)) {
    throw new Error(`${prefix} must be an object`)
  }

  assertString(value.id, `${prefix}.id`)
  assertString(value.slug, `${prefix}.slug`)
  assertRawContent(value.rawContent, prefix)
  assertMetadata(value.metadata, prefix)
  assertMetadataStatus(value.metadataStatus, prefix)
  assertPreferences(value.preferences, prefix)
  assertSync(value.sync, prefix)

  if (value.source !== undefined) {
    assertSource(value.source, prefix)
  }
}

function assertSource(value: unknown, prefix: string): asserts value is SkillSource {
  if (!isRecord(value)) {
    throw new Error(`${prefix}.source must be an object`)
  }

  if (!['github', 'local', 'unknown'].includes(value.type as string)) {
    throw new Error(`${prefix}.source.type is invalid`)
  }

  assertString(value.localPath, `${prefix}.source.localPath`)
  assertOptionalString(value.repository, `${prefix}.source.repository`)
  assertOptionalString(value.path, `${prefix}.source.path`)
  assertOptionalString(value.version, `${prefix}.source.version`)
  assertOptionalString(value.hash, `${prefix}.source.hash`)
}

function assertRawContent(value: unknown, prefix: string): asserts value is RawContentReference {
  if (!isRecord(value)) {
    throw new Error(`${prefix}.rawContent must be an object`)
  }

  assertString(value.path, `${prefix}.rawContent.path`)
  assertString(value.hash, `${prefix}.rawContent.hash`)
  assertString(value.lastSyncedAt, `${prefix}.rawContent.lastSyncedAt`)
}

function assertMetadata(value: unknown, prefix: string): asserts value is SkillMetadata {
  if (!isRecord(value)) {
    throw new Error(`${prefix}.metadata must be an object`)
  }

  assertString(value.name, `${prefix}.metadata.name`)
  assertString(value.summary, `${prefix}.metadata.summary`)
  assertStringArray(value.categories, `${prefix}.metadata.categories`)
  assertStringArray(value.useCases, `${prefix}.metadata.useCases`)
  assertString(value.usage, `${prefix}.metadata.usage`)
  assertStringArray(value.triggers, `${prefix}.metadata.triggers`)
}

function assertMetadataStatus(value: unknown, prefix: string): asserts value is MetadataStatus {
  if (!isRecord(value)) {
    throw new Error(`${prefix}.metadataStatus must be an object`)
  }

  if (!['ai', 'human', 'unknown'].includes(value.generatedBy as string)) {
    throw new Error(`${prefix}.metadataStatus.generatedBy must be ai or human`)
  }

  if (typeof value.reviewed !== 'boolean') {
    throw new Error(`${prefix}.metadataStatus.reviewed must be a boolean`)
  }

  assertOptionalString(value.lastGeneratedAt, `${prefix}.metadataStatus.lastGeneratedAt`)
  assertOptionalString(value.lastReviewedAt, `${prefix}.metadataStatus.lastReviewedAt`)
  assertOptionalString(value.error, `${prefix}.metadataStatus.error`)
}

function assertPreferences(value: unknown, prefix: string): asserts value is SkillPreferences {
  if (!isRecord(value)) {
    throw new Error(`${prefix}.preferences must be an object`)
  }

  if (typeof value.enabled !== 'boolean') {
    throw new Error(`${prefix}.preferences.enabled must be a boolean`)
  }

  if (typeof value.favorite !== 'boolean') {
    throw new Error(`${prefix}.preferences.favorite must be a boolean`)
  }
}

function assertSync(value: unknown, prefix: string): asserts value is SkillSyncStatus {
  if (!isRecord(value)) {
    throw new Error(`${prefix}.sync must be an object`)
  }

  if (!['up-to-date', 'needs-review', 'missing', 'error'].includes(value.status as string)) {
    throw new Error(`${prefix}.sync.status is invalid`)
  }

  assertString(value.lastCheckedAt, `${prefix}.sync.lastCheckedAt`)
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`)
  }
}

function assertOptionalString(value: unknown, field: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`${field} must be a string when provided`)
  }
}

function assertStringArray(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${field} must be an array of strings`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
