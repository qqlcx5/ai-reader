import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assertCatalog, type SkillCatalog, type SkillRecord } from './schema.js'
import type { DiscoveredSkill } from './skill-discovery.js'

export interface SyncSummary {
  added: number
  changed: number
  unchanged: number
  missing: number
}

export interface SyncResult {
  catalog: SkillCatalog
  summary: SyncSummary
}

export async function syncCatalog(
  discovered: DiscoveredSkill[],
  dataDirectory: string,
  now: string = new Date().toISOString(),
  providedCatalog?: SkillCatalog,
): Promise<SyncResult> {
  const existing = providedCatalog ?? (await readCatalog(dataDirectory))
  const existingById = new Map(existing.skills.map((skill) => [skill.id, skill]))
  const discoveredIds = new Set(discovered.map((skill) => skill.id))
  const summary: SyncSummary = { added: 0, changed: 0, unchanged: 0, missing: 0 }
  const skills: SkillRecord[] = []

  await mkdir(join(dataDirectory, 'content'), { recursive: true })

  for (const skill of discovered) {
    const hash = hashContent(skill.content)
    const previous = existingById.get(skill.id)
    const contentChanged = previous !== undefined && previous.rawContent.hash !== hash
    const rawPath = `content/${skill.id}.md`

    await writeFileIfChanged(join(dataDirectory, rawPath), skill.content, contentChanged || !previous)

    if (!previous) {
      summary.added += 1
      skills.push(createRecord(skill, hash, rawPath, now))
      continue
    }

    if (contentChanged) {
      summary.changed += 1
    } else {
      summary.unchanged += 1
    }

    skills.push({
      ...previous,
      source: skill.source ?? previous.source,
      rawContent: {
        ...previous.rawContent,
        path: rawPath,
        hash,
        lastSyncedAt: contentChanged ? now : previous.rawContent.lastSyncedAt,
      },
      sync: {
        status: contentChanged ? 'needs-review' : 'up-to-date',
        lastCheckedAt: now,
      },
    })
  }

  for (const previous of existing.skills) {
    if (discoveredIds.has(previous.id)) {
      continue
    }

    summary.missing += 1
    skills.push({
      ...previous,
      sync: { status: 'missing', lastCheckedAt: now },
    })
  }

  const catalog: SkillCatalog = {
    schemaVersion: 1,
    updatedAt: now,
    skills,
  }

  await writeCatalog(dataDirectory, catalog)
  return { catalog, summary }
}

export async function readCatalog(dataDirectory: string): Promise<SkillCatalog> {
  try {
    const raw = await readFile(join(dataDirectory, 'skills.json'), 'utf8')
    return assertCatalog(JSON.parse(raw))
  } catch (error) {
    if (isMissingFile(error)) {
      return { schemaVersion: 1, updatedAt: new Date(0).toISOString(), skills: [] }
    }
    throw error
  }
}

export async function writeCatalog(dataDirectory: string, catalog: SkillCatalog): Promise<void> {
  assertCatalog(catalog)
  await mkdir(dataDirectory, { recursive: true })
  await writeJsonAtomically(join(dataDirectory, 'skills.json'), catalog)
}

function createRecord(
  skill: DiscoveredSkill,
  hash: string,
  rawPath: string,
  now: string,
): SkillRecord {
  return {
    id: skill.id,
    slug: skill.slug,
    source: skill.source,
    rawContent: { path: rawPath, hash, lastSyncedAt: now },
    metadata: {
      name: skill.name ?? skill.id,
      summary: skill.description ?? '',
      categories: [],
      useCases: [],
      usage: '',
      triggers: [],
    },
    metadataStatus: { generatedBy: 'unknown', reviewed: false },
    preferences: { enabled: true, favorite: false },
    sync: { status: 'up-to-date', lastCheckedAt: now },
  }
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

async function writeFileIfChanged(path: string, content: string, shouldWrite: boolean): Promise<void> {
  if (shouldWrite) {
    await writeFile(path, content, 'utf8')
  }
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  const temporaryPath = `${path}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, path)
}

function isMissingFile(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
