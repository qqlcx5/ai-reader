import { describe, it, expect } from 'vitest'
import { buildAnalysisPrompt } from './analysis'
import type { ModelConfig } from '@/types/model'

function fakeModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'm1',
    name: 'test',
    provider: 'openai-compatible',
    modelId: 'gpt-x',
    enabled: true,
    isDefault: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildAnalysisPrompt', () => {
  it('attaches page context to the user turn', () => {
    const out = buildAnalysisPrompt({
      model: fakeModel(),
      page: {
        title: 'T',
        url: 'https://x.test/a',
        markdown: 'BODY',
        wordCount: 1,
        tokenCount: 1,
      },
      promptTemplateContent: '总结',
    })
    expect(out.system).toBeUndefined()
    const user = out.messages.find((m) => m.role === 'user')
    expect(user?.content).toContain('BODY')
    expect(user?.content).toContain('总结')
    expect(out.sentUserContent).toBe(user?.content)
  })

  it('model systemPrompt overrides fallback', () => {
    const out = buildAnalysisPrompt({
      model: fakeModel({ systemPrompt: 'SYS-MODEL' }),
      fallbackSystemPrompt: 'SYS-GLOBAL',
    })
    expect(out.system).toBe('SYS-MODEL')
  })

  it('falls back to global systemPrompt when model has none', () => {
    const out = buildAnalysisPrompt({
      model: fakeModel(),
      fallbackSystemPrompt: 'SYS-GLOBAL',
    })
    expect(out.system).toBe('SYS-GLOBAL')
  })

  it('empty everything → no user message, no system', () => {
    const out = buildAnalysisPrompt({ model: fakeModel() })
    expect(out.messages).toEqual([])
    expect(out.system).toBeUndefined()
    expect(out.sentUserContent).toBe('')
  })

  it('history is appended before the current user turn', () => {
    const out = buildAnalysisPrompt({
      model: fakeModel(),
      userInput: 'q2',
      history: [
        { role: 'user', content: 'q1' },
        { role: 'assistant', content: 'a1' },
      ],
    })
    const roles = out.messages.map((m) => m.role)
    expect(roles).toEqual(['user', 'assistant', 'user'])
    expect(out.messages.at(-1)?.content).toBe('q2')
  })
})
