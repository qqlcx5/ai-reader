import { describe, expect, it } from 'vitest'
import { mergeLockMetadata, parseLockFile } from '../../src/core/lockfile'
import type { DiscoveredSkill } from '../../src/core/skill-discovery'

const discovered: DiscoveredSkill[] = [
  {
    id: 'research',
    slug: 'research',
    localPath: '.agents/skills/research/SKILL.md',
    content: '# Research',
  },
  {
    id: 'local-only',
    slug: 'local-only',
    localPath: '.agents/skills/local-only/SKILL.md',
    content: '# Local',
  },
]

describe('parseLockFile', () => {
  it('parses lock records and ignores unrelated top-level fields', () => {
    const result = parseLockFile({
      version: 1,
      skills: {
        research: {
          source: 'owner/repository',
          sourceType: 'github',
          skillPath: 'skills/research/SKILL.md',
          ref: 'main',
          computedHash: 'abc',
        },
      },
    })

    expect(result).toEqual({
      version: 1,
      skills: {
        research: {
          source: 'owner/repository',
          sourceType: 'github',
          skillPath: 'skills/research/SKILL.md',
          ref: 'main',
          computedHash: 'abc',
        },
      },
    })
  })

  it('rejects malformed lock files', () => {
    expect(() => parseLockFile({ version: 1, skills: [] })).toThrow('skills must be an object')
  })
})

describe('mergeLockMetadata', () => {
  it('merges matching records without dropping local-only Skills', () => {
    const result = mergeLockMetadata(discovered, {
      version: 1,
      skills: {
        research: {
          source: 'owner/repository',
          sourceType: 'github',
          skillPath: 'skills/research/SKILL.md',
          ref: 'main',
          computedHash: 'abc',
        },
        'remote-only': {
          source: 'owner/repository',
          sourceType: 'github',
          skillPath: 'skills/remote-only/SKILL.md',
          ref: 'main',
          computedHash: 'def',
        },
      },
    })

    expect(result.skills).toHaveLength(2)
    expect(result.skills[0].source).toEqual({
      type: 'github',
      repository: 'owner/repository',
      path: 'skills/research/SKILL.md',
      localPath: '.agents/skills/research/SKILL.md',
      version: 'main',
      hash: 'abc',
    })
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ type: 'unmatched-lock-skill', id: 'remote-only' }),
    ])
  })
})
