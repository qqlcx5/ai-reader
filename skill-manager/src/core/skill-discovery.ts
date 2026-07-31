import { readFile, readdir } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'

import type { SkillSource } from './schema.js'

export interface DiscoveredSkill {
  id: string
  slug: string
  name?: string
  description?: string
  localPath: string
  content: string
  source?: SkillSource
}

export type DiscoveryDiagnostic =
  | { type: 'directory-error'; path: string; message: string }
  | { type: 'file-error'; path: string; message: string }
  | { type: 'duplicate-id'; id: string; paths: string[] }

export interface DiscoveryResult {
  skills: DiscoveredSkill[]
  diagnostics: DiscoveryDiagnostic[]
}

export async function discoverSkills(
  directories: string[],
  rootDirectory: string = process.cwd(),
): Promise<DiscoveryResult> {
  const skills: DiscoveredSkill[] = []
  const diagnostics: DiscoveryDiagnostic[] = []
  const seen = new Map<string, string>()

  for (const directory of directories) {
    const absoluteDirectory = resolve(rootDirectory, directory)
    let skillFiles: string[]

    try {
      skillFiles = await findSkillFiles(absoluteDirectory)
    } catch (error) {
      diagnostics.push({
        type: 'directory-error',
        path: relative(rootDirectory, absoluteDirectory),
        message: getErrorMessage(error),
      })
      continue
    }

    for (const filePath of skillFiles) {
      try {
        const content = await readFile(filePath, 'utf8')
        const id = basename(dirname(filePath))
        const localPath = relative(rootDirectory, filePath)
        const existingPath = seen.get(id)

        if (existingPath) {
          diagnostics.push({
            type: 'duplicate-id',
            id,
            paths: [existingPath, localPath],
          })
          continue
        }

        seen.set(id, localPath)
        skills.push({
          id,
          slug: id,
          localPath,
          content,
          ...parseFrontmatter(content),
        })
      } catch (error) {
        diagnostics.push({
          type: 'file-error',
          path: relative(rootDirectory, filePath),
          message: getErrorMessage(error),
        })
      }
    }
  }

  return {
    skills: skills.sort((left, right) => left.id.localeCompare(right.id)),
    diagnostics,
  }
}

async function findSkillFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const path = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await findSkillFiles(path)))
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      files.push(path)
    }
  }

  return files.sort()
}

function parseFrontmatter(content: string): Pick<DiscoveredSkill, 'name' | 'description'> {
  if (!content.startsWith('---')) {
    return {}
  }

  const end = content.indexOf('\n---', 3)
  if (end === -1) {
    return {}
  }

  const values: Record<string, string> = {}
  for (const line of content.slice(3, end).split('\n')) {
    const separator = line.indexOf(':')
    if (separator === -1) {
      continue
    }

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key === 'name' || key === 'description') {
      values[key] = unquote(value)
    }
  }

  return values
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
