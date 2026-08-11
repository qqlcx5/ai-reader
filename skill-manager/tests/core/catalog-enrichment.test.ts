import { mkdir, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { enrichCatalog } from '../../src/core/catalog-enrichment'
import { writeCatalog } from '../../src/core/skill-sync'
import type { SkillCatalog } from '../../src/core/schema'

const catalog: SkillCatalog = {
  schemaVersion: 1,
  updatedAt: 'now',
  skills: [
    {
      id: 'research',
      slug: 'research',
      rawContent: { path: 'content/research.md', hash: 'a', lastSyncedAt: 'now' },
      metadata: {
        name: 'research',
        summary: '',
        categories: [],
        useCases: [],
        usage: '',
        triggers: [],
      },
      metadataStatus: { generatedBy: 'unknown', reviewed: false },
      preferences: { enabled: true, favorite: false },
      sync: { status: 'up-to-date', lastCheckedAt: 'now' },
    },
    {
      id: 'reviewed',
      slug: 'reviewed',
      rawContent: { path: 'content/reviewed.md', hash: 'b', lastSyncedAt: 'now' },
      metadata: {
        name: '已确认',
        summary: '不要覆盖',
        categories: ['研究'],
        useCases: [],
        usage: '',
        triggers: [],
      },
      metadataStatus: { generatedBy: 'human', reviewed: true },
      preferences: { enabled: true, favorite: false },
      sync: { status: 'up-to-date', lastCheckedAt: 'now' },
    },
  ],
}

describe('enrichCatalog', () => {
  it('updates unreviewed metadata and skips reviewed records', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'skill-manager-enrich-'))
    await mkdir(join(dataDirectory, 'content'))
    await writeFile(join(dataDirectory, 'content/research.md'), '# Research', 'utf8')
    await writeFile(join(dataDirectory, 'content/reviewed.md'), '# Reviewed', 'utf8')
    await writeCatalog(dataDirectory, catalog)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            name: '研究助手', summary: '中文摘要', categories: ['研究'], useCases: ['调研'], usage: '研究时使用', triggers: ['调研'],
          }) } }],
        }),
        { status: 200 },
      ),
    )

    const result = await enrichCatalog(dataDirectory, {
      baseUrl: 'https://example.test/v1',
      apiKey: 'key',
      model: 'model',
    }, '2026-07-30T00:00:00.000Z')

    expect(result.summary).toEqual({ enriched: 1, skipped: 1, failed: 0 })
    expect(result.catalog.skills[0]).toMatchObject({
      metadata: { name: '研究助手' },
      metadataStatus: { generatedBy: 'ai', reviewed: false, lastGeneratedAt: '2026-07-30T00:00:00.000Z' },
    })
    expect(result.catalog.skills[1].metadata.summary).toBe('不要覆盖')
    vi.restoreAllMocks()
  })

  it('records a retryable error without losing existing metadata', async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'skill-manager-enrich-'))
    await mkdir(join(dataDirectory, 'content'))
    await writeFile(join(dataDirectory, 'content/research.md'), '# Research', 'utf8')
    await writeCatalog(dataDirectory, catalog)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('failure', { status: 500 }))

    const result = await enrichCatalog(dataDirectory, {
      baseUrl: 'https://example.test/v1', apiKey: 'key', model: 'model',
    }, '2026-07-30T00:00:00.000Z')

    expect(result.summary.failed).toBe(1)
    expect(result.catalog.skills[0].metadata.name).toBe('research')
    expect(result.catalog.skills[0].metadataStatus.error).toContain('HTTP 500')
    vi.restoreAllMocks()
  })
})
