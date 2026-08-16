import { describe, it, expect, vi } from 'vitest'
import { splitBlocks, parseTranslatedBlocks, translateDocument, defaultTargetLang } from './translate'
import type { DocumentEntity } from '@/types/document'
import type { ModelConfig } from '@/types/model'
import type { AIProvider } from '@/services/ai/types'

const model: ModelConfig = {
  id: 'm1', provider: 'openai-compatible', modelId: 'gpt-test', name: 'test', enabled: true,
} as unknown as ModelConfig

function makeDoc(markdown: string): DocumentEntity {
  const now = new Date().toISOString()
  return {
    id: 'doc-1', url: 'https://example.com/a', title: 'T', markdown,
    wordCount: 1, tokenCount: 1, contentHash: 'h1',
    extractionMethod: 'defuddle', source: 'library', capturedAt: now, updatedAt: now,
  } as DocumentEntity
}

function fakeProvider(handler: (payload: string) => string): AIProvider {
  return {
    chat: vi.fn(async (input: any) => ({ content: handler(input.messages[0].content) })),
    streamChat: vi.fn(),
    testConnection: vi.fn(),
  } as unknown as AIProvider
}

describe('splitBlocks', () => {
  it('splits on blank lines and keeps code fences whole', () => {
    const md = ['第一段。', '', '```js', 'const a = 1;', '', 'const b = 2;', '```', '', '第三段。'].join('\n')
    const blocks = splitBlocks(md)
    expect(blocks).toHaveLength(3)
    expect(blocks[1]).toContain('```js')
    expect(blocks[1]).toContain('const b = 2;')
  })
})

describe('parseTranslatedBlocks', () => {
  it('maps markers back to indices', () => {
    const raw = '⟦0⟧\nHello.\n\n⟦2⟧\nThird.'
    const map = parseTranslatedBlocks(raw)
    expect(map.get(0)).toBe('Hello.')
    expect(map.get(2)).toBe('Third.')
    expect(map.has(1)).toBe(false)
  })
})

describe('defaultTargetLang', () => {
  it('flips CJK ↔ latin defaults', () => {
    expect(defaultTargetLang('你好世界')).toBe('English')
    expect(defaultTargetLang('Hello world')).toBe('中文')
  })
})

describe('translateDocument', () => {
  it('translates blocks and keeps originals for missing markers', async () => {
    const provider = fakeProvider((payload) => {
      // Translate block 0 only; drop the rest.
      const m = /\u27e6(\d+)\u27e7/.exec(payload)!
      return `\u27e6${m[1]}\u27e7\nTRANSLATED`
    })
    const doc = makeDoc('第一段内容。\n\n第二段内容。\n\n第三段内容。')
    const result = await translateDocument({ document: doc, model, targetLang: 'English', provider })
    expect(result.lang).toBe('English')
    expect(result.markdown).toContain('TRANSLATED')
    expect(result.markdown).toContain('第二段内容。') // fallback preserved
    expect(result.translatedAt).toBeTruthy()
  })

  it('throws only when every batch fails', async () => {
    const provider = {
      chat: vi.fn().mockRejectedValue(new Error('boom')),
      streamChat: vi.fn(),
      testConnection: vi.fn(),
    } as unknown as AIProvider
    await expect(
      translateDocument({ document: makeDoc('一段话。'), model, targetLang: 'English', provider }),
    ).rejects.toThrow('所有请求')
  })

  it('sends markers and target language in the prompt', async () => {
    const chat = vi.fn().mockResolvedValue({ content: '' })
    const provider = { chat, streamChat: vi.fn(), testConnection: vi.fn() } as unknown as AIProvider
    const doc = makeDoc('你好')
    await translateDocument({ document: doc, model, targetLang: '日本語', provider })
    const input = chat.mock.calls[0][0]
    expect(input.systemPrompt).toContain('日本語')
    expect(input.messages[0].content).toContain('\u27e60\u27e7')
  })
})
