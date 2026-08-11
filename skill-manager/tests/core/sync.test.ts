import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { syncCatalog } from '../../src/core/skill-sync'
import type { DiscoveredSkill } from '../../src/core/skill-discovery'

const baseSkill: DiscoveredSkill = {
  id: 'research',
  slug: 'research',
  name: 'research',
  description: 'Research sources',
  localPath: '.agents/skills/research/SKILL.md',
  content: '# Research\n\nUse sources.',
  source: {
    type: 'github',
    repository: 'owner/repository',
    path: 'skills/research/SKILL.md',
    localPath: '.agents/skills/research/SKILL.md',
    version: 'main',
    hash: 'source-hash',
  },
}

describe('syncCatalog', () => {
  it('creates catalog and raw content files on the first sync', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'skill-manager-data-'))

    const result = await syncCatalog([baseSkill], dataDirectory, '2026-07-30T00:00:00.000Z')

    expect(result.summary).toEqual({ added: 1, changed: 0, unchanged: 0, missing: 0 })
    expect(result.catalog.skills[0]).toMatchObject({
      id: 'research',
      rawContent: {
        path: 'content/research.md',
        lastSyncedAt: '2026-07-30T00:00:00.000Z',
      },
      metadata: {
        name: 'research',
        summary: 'Research sources',
      },
      preferences: { enabled: true, favorite: false },
      sync: { status: 'up-to-date', lastCheckedAt: '2026-07-30T00:00:00.000Z' },
    })
    expect(await readFile(join(dataDirectory, 'content/research.md'), 'utf8')).toBe(baseSkill.content)
    expect(await readFile(join(dataDirectory, 'skills.json'), 'utf8')).toContain('research')
  })

  it('is idempotent and preserves reviewed metadata and preferences', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'skill-manager-data-'))
    const first = await syncCatalog([baseSkill], dataDirectory, '2026-07-30T00:00:00.000Z')
    first.catalog.skills[0].metadata = {
      ...first.catalog.skills[0].metadata,
      name: '研究助手',
      summary: '人工确认的摘要',
    }
    first.catalog.skills[0].metadataStatus = {
      generatedBy: 'human',
      reviewed: true,
      lastReviewedAt: '2026-07-30T00:01:00.000Z',
    }
    first.catalog.skills[0].preferences.enabled = false
    await syncCatalog([baseSkill], dataDirectory, '2026-07-30T00:02:00.000Z', first.catalog)

    const second = await syncCatalog([baseSkill], dataDirectory, '2026-07-30T00:03:00.000Z')

    expect(second.summary).toEqual({ added: 0, changed: 0, unchanged: 1, missing: 0 })
    expect(second.catalog.skills[0]).toMatchObject({
      metadata: { name: '研究助手', summary: '人工确认的摘要' },
      metadataStatus: { generatedBy: 'human', reviewed: true },
      preferences: { enabled: false, favorite: false },
      sync: { status: 'up-to-date', lastCheckedAt: '2026-07-30T00:03:00.000Z' },
    })
  })

  it('marks changed content for review without overwriting reviewed metadata', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'skill-manager-data-'))
    const first = await syncCatalog([baseSkill], dataDirectory, '2026-07-30T00:00:00.000Z')
    first.catalog.skills[0].metadata = {
      ...first.catalog.skills[0].metadata,
      name: '研究助手',
    }
    first.catalog.skills[0].metadataStatus.reviewed = true
    await syncCatalog([baseSkill], dataDirectory, '2026-07-30T00:01:00.000Z', first.catalog)

    const changed = await syncCatalog(
      [{ ...baseSkill, content: '# Research\n\nChanged.' }],
      dataDirectory,
      '2026-07-30T00:02:00.000Z',
    )

    expect(changed.summary).toEqual({ added: 0, changed: 1, unchanged: 0, missing: 0 })
    expect(changed.catalog.skills[0]).toMatchObject({
      metadata: { name: '研究助手' },
      metadataStatus: { reviewed: true },
      sync: { status: 'needs-review' },
    })
  })
})
