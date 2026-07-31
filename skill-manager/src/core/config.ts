import { readFileSync } from 'node:fs'

export interface SkillSourceConfig {
  skillDirectories: string[]
  lockFile: string
  dataDirectory: string
}

export interface AiConfig {
  baseUrl?: string
  apiKey?: string
  model?: string
}

export interface SkillManagerConfig {
  source: SkillSourceConfig
  ai: AiConfig
}

const DEFAULT_CONFIG: SkillSourceConfig = {
  skillDirectories: ['.agents/skills'],
  lockFile: 'skills-lock.json',
  dataDirectory: 'data',
}

export function createConfig(overrides: Partial<SkillSourceConfig> = {}): SkillManagerConfig {
  return {
    source: {
      ...DEFAULT_CONFIG,
      ...overrides,
    },
    ai: {
      baseUrl: process.env.SKILL_MANAGER_AI_BASE_URL,
      apiKey: process.env.SKILL_MANAGER_AI_API_KEY,
      model: process.env.SKILL_MANAGER_AI_MODEL,
    },
  }
}

export function loadConfig(configPath: string = 'config/sources.json'): SkillManagerConfig {
  try {
    const source = JSON.parse(readFileSync(configPath, 'utf8')) as Partial<SkillSourceConfig>
    return createConfig(source)
  } catch (error) {
    if (isMissingFile(error)) {
      return createConfig()
    }
    throw error
  }
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

export function hasAiConfig(config: SkillManagerConfig): boolean {
  return Boolean(config.ai.baseUrl && config.ai.apiKey && config.ai.model)
}
