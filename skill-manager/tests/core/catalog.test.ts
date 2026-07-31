import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { exportEnabledSkills, filterSkills, listCategories } from '../../src/core/skill-catalog'
import type { SkillCatalog, SkillRecord } from '../../src/core/schema'

function skill(overrides: Partial<SkillRecord>): SkillRecord {
  return {
    id: 'research',
    slug: 'research',
    rawContent: { path: 'content/research.md', hash: 'a', lastSyncedAt: 'now' },
    metadata: {
      name: '研究助手',
      summary: '查找可靠资料',
      categories: ['研究'],
      useCases: ['资料调研'],
      usage: '需要研究时使用',
      triggers: ['调研'],
    },
    metadataStatus: { generatedBy: 'human', reviewed: true },
    preferences: { enabled: true, favorite: false },
    sync: { status: 'up-to-date', lastCheckedAt: 'now' },
    ...overrides,
  }
}

const skills = [
  skill({}),
  skill({
    id: 'writing',
    slug: 'writing',
    metadata: {
      name: '写作助手',
      summary: '组织文章结构',
      categories: ['写作'],
      useCases: ['文章写作'],
      usage: '需要写作时使用',
      triggers: ['写文章'],
    },
    preferences: { enabled: false, favorite: true },
  }),
]

describe('filterSkills', () => {
  it('searches across metadata fields and composes filters', () => {
    expect(filterSkills(skills, { query: '文章', enabled: false })).toHaveLength(1)
    expect(filterSkills(skills, { category: '研究' })).toEqual([skills[0]])
    expect(filterSkills(skills, { favorite: true })).toEqual([skills[1]])
    expect(filterSkills(skills, { query: '不存在' })).toEqual([])
  })

  it('lists unique sorted categories', () => {
    expect(listCategories(skills)).toEqual(['写作', '研究'])
  })
})

describe('exportEnabledSkills', () => {
  it('writes a valid catalog containing only enabled Skills', async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), 'skill-manager-export-'))
    const catalog: SkillCatalog = {
      schemaVersion: 1,
      updatedAt: 'now',
      skills,
    }

    const output = await exportEnabledSkills(catalog, join(outputDirectory, 'enabled-skills.json'))

    expect(output.skills.map((item) => item.id)).toEqual(['research'])
    const saved = JSON.parse(await readFile(join(outputDirectory, 'enabled-skills.json'), 'utf8'))
    expect(saved.skills.map((item: SkillRecord) => item.id)).toEqual(['research'])
  })
})
