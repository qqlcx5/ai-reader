import { writeFile } from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { SkillCatalog, SkillRecord } from './schema.js'

export interface SkillFilterOptions {
  query?: string
  category?: string
  enabled?: boolean
  favorite?: boolean
}

export function filterSkills(skills: SkillRecord[], options: SkillFilterOptions = {}): SkillRecord[] {
  const query = options.query?.trim().toLocaleLowerCase()

  return skills.filter((skill) => {
    if (options.category && !skill.metadata.categories.includes(options.category)) {
      return false
    }

    if (options.enabled !== undefined && skill.preferences.enabled !== options.enabled) {
      return false
    }

    if (options.favorite !== undefined && skill.preferences.favorite !== options.favorite) {
      return false
    }

    if (!query) {
      return true
    }

    return searchableText(skill).toLocaleLowerCase().includes(query)
  })
}

export function listCategories(skills: SkillRecord[]): string[] {
  return [...new Set(skills.flatMap((skill) => skill.metadata.categories))].sort((a, b) =>
    a.localeCompare(b),
  )
}

export async function exportEnabledSkills(
  catalog: SkillCatalog,
  outputPath: string,
): Promise<SkillCatalog> {
  const enabledCatalog: SkillCatalog = {
    ...catalog,
    skills: catalog.skills.filter((skill) => skill.preferences.enabled),
  }

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(enabledCatalog, null, 2)}\n`, 'utf8')
  return enabledCatalog
}

function searchableText(skill: SkillRecord): string {
  return [
    skill.id,
    skill.slug,
    skill.metadata.name,
    skill.metadata.summary,
    ...skill.metadata.categories,
    ...skill.metadata.useCases,
    skill.metadata.usage,
    ...skill.metadata.triggers,
  ].join('\n')
}
