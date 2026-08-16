import { describe, it, expect, vi } from 'vitest'
import { parseTags, suggestTags } from './auto-tag'
import type { DocumentEntity } from '@/types/document'
import type { ModelConfig } from '@/types/model'
import type { AIProvider } from '@/services/ai/types'

const model: ModelConfig = {
  id: 'm1', provider: 'openai-compatible', modelId: 'gpt-test', name: 'test', enabled: true,
} as unknown as ModelConfig

function makeDoc(): DocumentEntity {
  const now = new Date().toISOString()
  return {
    id: 'doc-1', url: 'https://example.com/a', title: 'Transformer 详解',
    markdown: 'Transformer 是一种基于自注意力的架构。',
    wordCount: 10, tokenCount: 10, contentHash: 'h1',
    extractionMethod: 'defuddle', source: 'library', capturedAt: now, updatedAt: now,
  } as DocumentEntity
}

function fakeProvider(content: string): AIProvider {
  return {
    chat: vi.fn().mockResolvedValue({ content }),
    streamChat: vi.fn(),
    testConnection: vi.fn(),
  } as unknown as AIProvider
}

describe('parseTags', () => {
  it('parses plain arrays and fenced output', () => {
    expect(parseTags('["机器学习","教程"]')).toEqual(['机器学习', '教程'])
    expect(parseTags('好的：\n```json\n["Transformer"]\n```')).toEqual(['Transformer'])
  })

  it('drops non-strings and caps at 5', () => {
    expect(parseTags('["a",1,"b",null,"c","d","e","f"]')).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('returns empty for garbage', () => {
    expect(parseTags('抱歉')).toEqual([])
  })
})

describe('suggestTags', () => {
  it('sends title+excerpt material and returns deduped tags', async () => {
    const provider = fakeProvider('["Transformer","深度学习"]')
    const tags = await suggestTags({ document: makeDoc(), model, existing: ['transformer'], provider })
    expect(tags).toEqual(['深度学习'])
    const sent = (provider.chat as any).mock.calls[0][0].messages[0].content as string
    expect(sent).toContain('Transformer 详解')
  })

  it('returns [] instead of throwing when the provider fails', async () => {
    const provider = {
      chat: vi.fn().mockRejectedValue(new Error('boom')),
      streamChat: vi.fn(),
      testConnection: vi.fn(),
    } as unknown as AIProvider
    expect(await suggestTags({ document: makeDoc(), model, provider })).toEqual([])
  })
})
