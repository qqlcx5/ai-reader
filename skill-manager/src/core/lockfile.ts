import type { SkillSource } from './schema.js'
import type { DiscoveredSkill } from './skill-discovery.js'

export interface LockSkillEntry {
  source: string
  sourceType: string
  skillPath: string
  ref?: string
  computedHash?: string
}

export interface SkillLockFile {
  version: number
  skills: Record<string, LockSkillEntry>
}

export interface LockMergeResult {
  skills: Array<DiscoveredSkill & { source?: SkillSource }>
  diagnostics: Array<
    | { type: 'unmatched-lock-skill'; id: string }
    | { type: 'invalid-lock-entry'; id: string; message: string }
  >
}

export function parseLockFile(value: unknown): SkillLockFile {
  if (!isRecord(value)) {
    throw new Error('Lock file must be an object')
  }

  if (typeof value.version !== 'number') {
    throw new Error('version must be a number')
  }

  if (!isRecord(value.skills)) {
    throw new Error('skills must be an object')
  }

  const skills: Record<string, LockSkillEntry> = {}
  for (const [id, entry] of Object.entries(value.skills)) {
    skills[id] = parseLockEntry(id, entry)
  }

  return { version: value.version, skills }
}

export function mergeLockMetadata(
  discovered: DiscoveredSkill[],
  lockFile: SkillLockFile,
): LockMergeResult {
  const lockIds = new Set(Object.keys(lockFile.skills))
  const diagnostics: LockMergeResult['diagnostics'] = []
  const skills = discovered.map((skill) => {
    const entry = lockFile.skills[skill.id]
    if (!entry) {
      return skill
    }

    lockIds.delete(skill.id)
    return {
      ...skill,
      source: {
        type: normalizeSourceType(entry.sourceType),
        repository: entry.source,
        path: entry.skillPath,
        localPath: skill.localPath,
        version: entry.ref,
        hash: entry.computedHash,
      },
    }
  })

  for (const id of lockIds) {
    diagnostics.push({ type: 'unmatched-lock-skill', id })
  }

  return { skills, diagnostics }
}

function parseLockEntry(id: string, value: unknown): LockSkillEntry {
  if (!isRecord(value)) {
    throw new Error(`skills.${id} must be an object`)
  }

  assertString(value.source, `skills.${id}.source`)
  assertString(value.sourceType, `skills.${id}.sourceType`)
  assertString(value.skillPath, `skills.${id}.skillPath`)
  assertOptionalString(value.ref, `skills.${id}.ref`)
  assertOptionalString(value.computedHash, `skills.${id}.computedHash`)

  return {
    source: value.source,
    sourceType: value.sourceType,
    skillPath: value.skillPath,
    ref: value.ref,
    computedHash: value.computedHash,
  }
}

function normalizeSourceType(value: string): SkillSource['type'] {
  return value === 'github' ? 'github' : value === 'local' ? 'local' : 'unknown'
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
