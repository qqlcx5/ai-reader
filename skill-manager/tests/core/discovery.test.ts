import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { discoverSkills } from '../../src/core/skill-discovery'

async function createSource(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'skill-manager-'))

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(root, relativePath)
    await mkdir(join(filePath, '..'), { recursive: true })
    await writeFile(filePath, content, 'utf8')
  }

  return root
}

describe('discoverSkills', () => {
  it('discovers nested SKILL.md files and parses frontmatter', async () => {
    const root = await createSource({
      'skills/research/SKILL.md': `---\nname: research\ndescription: Research external sources\n---\n\nUse reliable sources.\n`,
      'skills/writing/SKILL.md': '# Writing\n\nHelp write clearly.\n',
    })

    const result = await discoverSkills([root], root)

    expect(result.diagnostics).toEqual([])
    expect(result.skills).toHaveLength(2)
    expect(result.skills[0]).toMatchObject({
      id: 'research',
      slug: 'research',
      name: 'research',
      description: 'Research external sources',
      localPath: 'skills/research/SKILL.md',
    })
    expect(result.skills[0].content).toContain('Use reliable sources.')
  })

  it('reports duplicate IDs and malformed directories without dropping valid files', async () => {
    const root = await createSource({
      'one/research/SKILL.md': '# One',
      'two/research/SKILL.md': '# Two',
      'missing/SKILL.md': '# Missing',
    })

    const result = await discoverSkills([join(root, 'one'), join(root, 'two'), join(root, 'missing')], root)

    expect(result.skills).toHaveLength(2)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ type: 'duplicate-id', id: 'research' }),
    ])
  })

  it('reports a missing configured directory', async () => {
    const root = await createSource({})
    const result = await discoverSkills([join(root, 'does-not-exist')], root)

    expect(result.skills).toEqual([])
    expect(result.diagnostics[0]).toMatchObject({ type: 'directory-error' })
  })
})
