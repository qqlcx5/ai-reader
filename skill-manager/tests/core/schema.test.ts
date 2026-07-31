import { describe, expect, it } from 'vitest'
import {
  assertCatalog,
  type SkillCatalog,
} from '../../src/core/schema'

const validCatalog: SkillCatalog = {
  schemaVersion: 1,
  updatedAt: '2026-07-30T00:00:00.000Z',
  skills: [
    {
      id: 'research',
      slug: 'research',
      source: {
        type: 'github',
        repository: 'owner/repository',
        path: 'skills/research/SKILL.md',
        localPath: '.agents/skills/research/SKILL.md',
        version: 'main',
        hash: 'abc',
      },
      rawContent: {
        path: 'content/research.md',
        hash: 'def',
        lastSyncedAt: '2026-07-30T00:00:00.000Z',
      },
      metadata: {
        name: '研究助手',
        summary: '用于系统化研究。',
        categories: ['研究'],
        useCases: ['资料调研'],
        usage: '需要研究时使用。',
        triggers: ['研究'],
      },
      metadataStatus: {
        generatedBy: 'ai',
        reviewed: true,
        lastGeneratedAt: '2026-07-30T00:00:00.000Z',
        lastReviewedAt: '2026-07-30T00:00:00.000Z',
      },
      preferences: {
        enabled: true,
        favorite: false,
      },
      sync: {
        status: 'up-to-date',
        lastCheckedAt: '2026-07-30T00:00:00.000Z',
      },
    },
  ],
}

describe('assertCatalog', () => {
  it('accepts a valid catalog and returns the same value', () => {
    expect(assertCatalog(validCatalog)).toBe(validCatalog)
  })

  it('rejects unsupported schema versions', () => {
    expect(() => assertCatalog({ ...validCatalog, schemaVersion: 2 })).toThrow(
      'Unsupported catalog schema version',
    )
  })

  it('rejects missing required top-level fields', () => {
    const invalid = { ...validCatalog, skills: undefined }

    expect(() => assertCatalog(invalid)).toThrow('skills must be an array')
  })

  it('rejects invalid metadata status values', () => {
    const invalid = {
      ...validCatalog,
      skills: [
        {
          ...validCatalog.skills[0],
          metadataStatus: { ...validCatalog.skills[0].metadataStatus, generatedBy: 'system' },
        },
      ],
    }

    expect(() => assertCatalog(invalid)).toThrow('generatedBy must be ai or human')
  })
})
