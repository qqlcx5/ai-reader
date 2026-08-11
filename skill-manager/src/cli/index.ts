import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createConfig, hasAiConfig, loadConfig, type SkillManagerConfig } from '../core/config.js'
import { enrichCatalog } from '../core/catalog-enrichment.js'
import { exportEnabledSkills, filterSkills } from '../core/skill-catalog.js'
import { mergeLockMetadata, parseLockFile } from '../core/lockfile.js'
import { discoverSkills } from '../core/skill-discovery.js'
import { syncCatalog, readCatalog } from '../core/skill-sync.js'

const COMMANDS = ['scan', 'sync', 'enrich', 'export', 'search'] as const

type Command = (typeof COMMANDS)[number]

export interface CliOptions {
  config?: SkillManagerConfig
  output?: (message: string) => void
  errorOutput?: (message: string) => void
}

function printHelp(output: (message: string) => void): void {
  output(`Usage: skill-manager <command> [options]\n\nCommands:\n  scan      Discover local SKILL.md files\n  sync      Synchronize raw content and catalog metadata\n  enrich    Generate Chinese metadata drafts\n  export    Export enabled Skills\n  search    Search the catalog\n\nOptions:\n  --help    Show this help message`)
}

function parseCommand(value: string | undefined): Command | '--help' {
  if (!value || value === '--help' || value === '-h') {
    return '--help'
  }

  if ((COMMANDS as readonly string[]).includes(value)) {
    return value as Command
  }

  throw new Error(`Unknown command: ${value}`)
}

export async function runCli(
  argv: string[] = process.argv.slice(2),
  options: CliOptions = {},
): Promise<number> {
  const output = options.output ?? console.log
  const errorOutput = options.errorOutput ?? console.error

  try {
    const command = parseCommand(argv[0])

    if (command === '--help') {
      printHelp(output)
      return 0
    }

    const config = options.config ?? loadConfig()
    if (command === 'scan') {
      const result = await discoverSkills(config.source.skillDirectories)
      output(JSON.stringify({ discovered: result.skills.length, diagnostics: result.diagnostics }, null, 2))
      return result.diagnostics.some((diagnostic) => diagnostic.type === 'directory-error') ? 1 : 0
    }

    if (command === 'sync') {
      const discovered = await discoverSkills(config.source.skillDirectories)
      const lockFile = parseLockFile(JSON.parse(await readFile(resolve(config.source.lockFile), 'utf8')))
      const merged = mergeLockMetadata(discovered.skills, lockFile)
      const result = await syncCatalog(merged.skills, resolve(config.source.dataDirectory))
      output(JSON.stringify({ ...result.summary, diagnostics: [...discovered.diagnostics, ...merged.diagnostics] }, null, 2))
      return 0
    }

    if (command === 'enrich') {
      if (!hasAiConfig(config)) {
        throw new Error('AI configuration is missing; set SKILL_MANAGER_AI_BASE_URL, SKILL_MANAGER_AI_API_KEY, and SKILL_MANAGER_AI_MODEL')
      }

      const result = await enrichCatalog(
        resolve(config.source.dataDirectory),
        config.ai,
        new Date().toISOString(),
        argv[1] ? [argv[1]] : undefined,
      )
      output(JSON.stringify(result.summary, null, 2))
      return result.summary.failed > 0 ? 1 : 0
    }

    if (command === 'export') {
      const catalog = await readCatalog(resolve(config.source.dataDirectory))
      const outputPath = resolve(config.source.dataDirectory, 'enabled-skills.json')
      const exported = await exportEnabledSkills(catalog, outputPath)
      output(JSON.stringify({ exported: exported.skills.length, outputPath }, null, 2))
      return 0
    }

    if (command === 'search') {
      const catalog = await readCatalog(resolve(config.source.dataDirectory))
      const results = filterSkills(catalog.skills, { query: argv.slice(1).join(' ') })
      output(JSON.stringify(results, null, 2))
      return 0
    }

    output(`${command} is planned and will be available in a later task.`)
    return 0
  } catch (error) {
    errorOutput(error instanceof Error ? error.message : String(error))
    printHelp(errorOutput)
    return 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().then((exitCode) => {
    process.exitCode = exitCode
  })
}
