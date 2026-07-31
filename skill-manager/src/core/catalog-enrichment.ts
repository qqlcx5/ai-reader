import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AiConfig } from './config.js'
import { generateMetadata } from './skill-enricher.js'
import type { SkillCatalog } from './schema.js'
import { readCatalog, writeCatalog } from './skill-sync.js'

export interface EnrichmentSummary {
  enriched: number
  skipped: number
  failed: number
}

export interface EnrichmentResult {
  catalog: SkillCatalog
  summary: EnrichmentSummary
}

export async function enrichCatalog(
  dataDirectory: string,
  aiConfig: AiConfig,
  now: string = new Date().toISOString(),
  skillIds?: string[],
): Promise<EnrichmentResult> {
  const catalog = await readCatalog(dataDirectory)
  const selectedIds = skillIds ? new Set(skillIds) : undefined
  const summary: EnrichmentSummary = { enriched: 0, skipped: 0, failed: 0 }

  for (const skill of catalog.skills) {
    if (selectedIds && !selectedIds.has(skill.id)) {
      continue
    }

    if (skill.metadataStatus.reviewed) {
      summary.skipped += 1
      continue
    }

    try {
      const content = await readFile(join(dataDirectory, skill.rawContent.path), 'utf8')
      skill.metadata = await generateMetadata(content, aiConfig)
      skill.metadataStatus = {
        ...skill.metadataStatus,
        generatedBy: 'ai',
        reviewed: false,
        lastGeneratedAt: now,
        error: undefined,
      }
      summary.enriched += 1
    } catch (error) {
      skill.metadataStatus = {
        ...skill.metadataStatus,
        error: error instanceof Error ? error.message : String(error),
      }
      summary.failed += 1
    }
  }

  catalog.updatedAt = now
  await writeCatalog(dataDirectory, catalog)
  return { catalog, summary }
}
