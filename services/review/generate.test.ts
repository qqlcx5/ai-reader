import { describe, it, expect, vi } from 'vitest'
import { generateFlashcards, parseCards } from './generate'
import type { DocumentEntity } from '@/types/document'
import type { ModelConfig } from '@/types/model'
import type { AIProvider, ChatOutput } from '@/services/ai/types'
import { initialSm2State } from '@/utils/sm2'

const model: ModelConfig = {
  id: 'm1',
  provider: 'openai-compatible',
  modelId: 'gpt-test',
  name: 'test',
  enabled: true,
} as unknown as ModelConfig

function makeDoc(overrides: Partial<DocumentEntity> = {}): DocumentEntity {
  return {
    id: 'doc-1',
    url: 'https://example.com/a',
    title: '测试文档',
    markdown: '# 标题\n\n正文内容，足够长的一段话，用于在没有高亮时作为材料。',
    wordCount: 100,
    tokenCount: 100,
    contentHash: 'hash-1',
    extractionMethod: 'defuddle',
    source: 'current-page',
    capturedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as DocumentEntity
}

function fakeProvider(content: string): AIProvider {
  return {
    chat: vi.fn().mockResolvedValue({ content } satisfies ChatOutput),
    streamChat: vi.fn(),
    testConnection: vi.fn(),
  } as unknown as AIProvider
}

describe('parseCards', () => {
  it('parses a plain JSON array', () => {
    const r = parseCards('[{"front":"Q1","back":"A1"}]')
    expect('cards' in r && r.cards).toHaveLength(1)
  })

  it('parses a fenced code block', () => {
    const r = parseCards('以下是闪卡：\n```json\n[{"front":"Q","back":"A"}]\n```')
    expect('cards' in r && r.cards[0].front).toBe('Q')
  })

  it('parses an array embedded in prose', () => {
    const r = parseCards('好的，这是结果：[{"front":"Q","back":"A"}] 希望有帮助')
    expect('cards' in r && r.cards).toHaveLength(1)
  })

  it('drops items with empty front/back', () => {
    const r = parseCards('[{"front":"","back":"A"},{"front":"Q","back":"A"}]')
    expect('cards' in r && r.cards).toHaveLength(1)
  })

  it('returns an error for garbage', () => {
    expect('error' in parseCards('')).toBe(true)
    expect('error' in parseCards('抱歉我不知道')).toBe(true)
  })
})

describe('generateFlashcards', () => {
  it('generates cards and dedupes against existing fronts', async () => {
    const provider = fakeProvider('[{"front":"什么是 X?","back":"X 是 Y"},{"front":"什么是 X ?","back":"重复"},{"front":"Q2","back":"A2"}]')
    const existing = [{
      id: 'e1', documentId: 'doc-1', front: '什么是 X?', back: 'old', source: 'ai' as const,
      sm2: initialSm2State(), createdAt: '', updatedAt: '',
    }]
    const { cards, parseError } = await generateFlashcards({
      document: makeDoc(), model, existing, provider,
    })
    expect(parseError).toBeUndefined()
    expect(cards).toHaveLength(1)
    expect(cards[0].front).toBe('Q2')
    expect(cards[0].source).toBe('ai')
    expect(cards[0].sm2.ease).toBe(2.5)
  })

  it('prefers highlights as source material when there are >= 3', async () => {
    const chat = vi.fn().mockResolvedValue({ content: '[]' })
    const provider = { chat, streamChat: vi.fn(), testConnection: vi.fn() } as unknown as AIProvider
    const doc = makeDoc({
      highlights: [
        { id: 'h1', startOffset: 0, endOffset: 30, text: '第一条足够长的高亮内容，长度超过二十个字符', createdAt: '', updatedAt: '' },
        { id: 'h2', startOffset: 0, endOffset: 30, text: '第二条足够长的高亮内容，长度超过二十个字符', createdAt: '', updatedAt: '' },
        { id: 'h3', startOffset: 0, endOffset: 30, text: '第三条足够长的高亮内容，长度超过二十个字符', note: '我的笔记', createdAt: '', updatedAt: '' },
      ],
    })
    await generateFlashcards({ document: doc, model, provider })
    const sent = chat.mock.calls[0][0].messages[0].content as string
    expect(sent).toContain('划的重点')
    expect(sent).toContain('我的笔记')
    expect(sent).not.toContain('# 标题')
  })

  it('generates cloze cards with the cloze prompt and type', async () => {
    const chat = vi.fn().mockResolvedValue({
      content: '[{"front":"Transformer 使用 ____ 机制","back":"自注意力"}]',
    })
    const provider = { chat, streamChat: vi.fn(), testConnection: vi.fn() } as unknown as AIProvider
    const { cards } = await generateFlashcards({ document: makeDoc(), model, provider, mode: 'cloze' })
    expect(cards).toHaveLength(1)
    expect(cards[0].type).toBe('cloze')
    const system = chat.mock.calls[0][0].systemPrompt as string
    expect(system).toContain('挖空')
    expect(system).not.toContain('问答卡')
  })

  it('returns parseError instead of throwing on unparsable output', async () => {
    const provider = fakeProvider('今天天气不错')
    const { cards, parseError } = await generateFlashcards({ document: makeDoc(), model, provider })
    expect(cards).toHaveLength(0)
    expect(parseError).toBeTruthy()
  })

  it('caps cards at the per-run maximum', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ front: `Q${i}`, back: `A${i}` }))
    const provider = fakeProvider(JSON.stringify(many))
    const { cards } = await generateFlashcards({ document: makeDoc(), model, provider })
    expect(cards.length).toBeLessThanOrEqual(8)
  })
})
