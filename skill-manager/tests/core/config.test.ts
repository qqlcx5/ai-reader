import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createConfig, hasAiConfig } from '../../src/core/config'

const originalEnv = { ...process.env }

describe('createConfig', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.SKILL_MANAGER_AI_BASE_URL
    delete process.env.SKILL_MANAGER_AI_API_KEY
    delete process.env.SKILL_MANAGER_AI_MODEL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('uses repository-friendly source defaults', () => {
    expect(createConfig().source).toEqual({
      skillDirectories: ['.agents/skills'],
      lockFile: 'skills-lock.json',
      dataDirectory: 'data',
    })
  })

  it('accepts source overrides without dropping defaults', () => {
    expect(createConfig({ lockFile: 'custom-lock.json' }).source).toEqual({
      skillDirectories: ['.agents/skills'],
      lockFile: 'custom-lock.json',
      dataDirectory: 'data',
    })
  })
})

describe('hasAiConfig', () => {
  it('requires all provider fields', () => {
    expect(hasAiConfig(createConfig())).toBe(false)

    process.env.SKILL_MANAGER_AI_BASE_URL = 'https://example.test/v1'
    process.env.SKILL_MANAGER_AI_API_KEY = 'test-key'
    process.env.SKILL_MANAGER_AI_MODEL = 'test-model'

    expect(hasAiConfig(createConfig())).toBe(true)
  })
})
