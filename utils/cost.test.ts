import { describe, it, expect } from 'vitest'
import { calcMessageCost, getModelPricing, formatTokens, formatCNY, aggregateUsage, aggregateByDay } from './cost'

function model(
  modelId: string,
  overrides: { inputPricePer1M?: number; outputPricePer1M?: number } = {},
) {
  return { modelId, ...overrides }
}

describe('getModelPricing', () => {
  it('uses manual override when both prices are set', () => {
    const p = getModelPricing(model('claude-opus-4-8', { inputPricePer1M: 1, outputPricePer1M: 2 }))
    expect(p).toEqual({ input: 1, output: 2 })
  })

  it('falls back to built-in table by modelId', () => {
    expect(getModelPricing(model('claude-opus-4-8'))).toEqual({ input: 35, output: 175 })
    expect(getModelPricing(model('gpt-5.5'))).toEqual({ input: 35, output: 210 })
    expect(getModelPricing(model('DeepSeek-V4-Flash'))).toEqual({ input: 1, output: 2 })
    expect(getModelPricing(model('gemini-3.5-flash'))).toEqual({ input: 10.5, output: 63 })
  })

  it('prefers gpt-5.4-mini over broader gpt-5.x patterns', () => {
    expect(getModelPricing(model('gpt-5.4-mini'))).toEqual({ input: 11.25, output: 67.5 })
  })

  it('matches deepseek pro over flash', () => {
    expect(getModelPricing(model('DeepSeek-V4-Pro'))).toEqual({ input: 3, output: 6 })
  })

  it('returns undefined for unknown / local models', () => {
    expect(getModelPricing(model('llama3.2'))).toBeUndefined()
    expect(getModelPricing(model('qwen2.5'))).toBeUndefined()
  })

  it('ignores a partial manual override (only one price set) and uses the table', () => {
    const p = getModelPricing(model('gpt-5.5', { inputPricePer1M: 5 }))
    expect(p).toEqual({ input: 35, output: 210 })
  })
})

describe('calcMessageCost', () => {
  it('computes CNY cost from usage and pricing', () => {
    // gpt-5.5: 35 in / 210 out per 1M; 1000 prompt + 500 completion
    const cost = calcMessageCost({ promptTokens: 1000, completionTokens: 500 }, model('gpt-5.5'))
    expect(cost).toBeCloseTo((1000 * 35 + 500 * 210) / 1e6, 6)
  })

  it('returns 0 when usage is zero', () => {
    expect(calcMessageCost({ promptTokens: 0, completionTokens: 0 }, model('gpt-5.5'))).toBe(0)
  })

  it('returns undefined when the model has no pricing', () => {
    expect(calcMessageCost({ promptTokens: 100, completionTokens: 50 }, model('llama3.2'))).toBeUndefined()
  })

  it('uses manual override prices when provided', () => {
    const cost = calcMessageCost(
      { promptTokens: 1_000_000, completionTokens: 0 },
      model('anything', { inputPricePer1M: 10, outputPricePer1M: 20 }),
    )
    expect(cost).toBeCloseTo(10, 6)
  })
})

describe('formatTokens', () => {
  it('formats plain numbers below 1k as-is', () => {
    expect(formatTokens(999)).toBe('999')
    expect(formatTokens(0)).toBe('0')
  })
  it('compacts thousands with one decimal', () => {
    expect(formatTokens(1500)).toBe('1.5k')
    expect(formatTokens(1000)).toBe('1k')
  })
  it('rounds large counts', () => {
    expect(formatTokens(150_000)).toBe('150k')
  })
})

describe('formatCNY', () => {
  it('formats zero and tiny costs without noise', () => {
    expect(formatCNY(0)).toBe('¥0')
    expect(formatCNY(0.003)).toBe('¥0.003')
  })
  it('keeps two decimals for normal amounts', () => {
    expect(formatCNY(0.5)).toBe('¥0.50')
    expect(formatCNY(1.234)).toBe('¥1.23')
  })
})

describe('aggregateUsage', () => {
  it('sums assistant usage across conversations and groups by model', () => {
    const conversations = [
      {
        id: 'c1', documentId: 'd1', createdAt: '', updatedAt: '',
        messages: [
          { id: 'm1', role: 'assistant', content: '', modelId: 'gpt-5.5', status: 'success', durationMs: 1000, firstTokenMs: 200, genMs: 800, createdAt: '', tokenUsage: { promptTokens: 100, completionTokens: 50 } },
          { id: 'm2', role: 'user', content: '', createdAt: '' },
          { id: 'm3', role: 'assistant', content: '', modelId: 'gpt-5.5', status: 'success', durationMs: 2000, firstTokenMs: 400, genMs: 1600, createdAt: '', tokenUsage: { promptTokens: 200, completionTokens: 100 } },
        ],
      },
    ] as any

    const models = [{ id: 'x', name: 'GPT-5.5', provider: 'openai-compatible', modelId: 'gpt-5.5', enabled: true, isDefault: false, createdAt: '', updatedAt: '' }] as any

    const agg = aggregateUsage(conversations, models)
    expect(agg.totalPrompt).toBe(300)
    expect(agg.totalCompletion).toBe(150)
    expect(agg.totalTokens).toBe(450)
    expect(agg.totalMessages).toBe(2)
    expect(agg.failedMessages).toBe(0)
    expect(agg.errorRate).toBe(0)
    expect(agg.avgDurationMs).toBe(1500)
    expect(agg.avgFirstTokenMs).toBe(300) // (200 + 400) / 2
    expect(agg.tokensPerSec).toBe(63) // 150 / ((800 + 1600) / 1000)
    expect(agg.byModel).toHaveLength(1)
    expect(agg.byModel[0].name).toBe('GPT-5.5')
    expect(agg.byModel[0].avgDurationMs).toBe(1500)
    expect(agg.byModel[0].tokensPerSec).toBe(63)
    // gpt-5.5: 35 in / 210 out per 1M
    expect(agg.totalCost).toBeCloseTo((300 * 35 + 150 * 210) / 1e6, 6)
  })

  it('counts errors and averages latency across all assistant messages', () => {
    const conversations = [
      {
        id: 'c1', documentId: 'd1', createdAt: '', updatedAt: '',
        messages: [
          { id: 'm1', role: 'assistant', content: '', modelId: 'llama', status: 'success', durationMs: 500, firstTokenMs: 100, genMs: 400, createdAt: '', tokenUsage: { promptTokens: 10, completionTokens: 5 } },
          { id: 'm2', role: 'assistant', content: '', modelId: 'gpt-5.5', status: 'failed', durationMs: 200, createdAt: '' },
        ],
      },
    ] as any

    const agg = aggregateUsage(conversations, [])
    expect(agg.totalMessages).toBe(2)
    expect(agg.failedMessages).toBe(1)
    expect(agg.errorRate).toBe(0.5)
    expect(agg.totalTokens).toBe(15) // only m1 has usage
    expect(agg.totalCost).toBe(0) // unknown models
    expect(agg.avgDurationMs).toBe(350) // (500 + 200) / 2
    expect(agg.avgFirstTokenMs).toBe(100) // only m1 has ttft
    expect(agg.tokensPerSec).toBe(13) // 5 / 0.4
    expect(agg.byModel).toHaveLength(2)
  })

  it('respects the fromMs time filter', () => {
    const conversations = [{
      id: 'c1', documentId: 'd1', createdAt: '', updatedAt: '',
      messages: [
        { id: 'm1', role: 'assistant', content: '', modelId: 'gpt-5.5', createdAt: '2026-06-01T00:00:00Z', tokenUsage: { promptTokens: 100, completionTokens: 50 } },
        { id: 'm2', role: 'assistant', content: '', modelId: 'gpt-5.5', createdAt: '2026-06-29T00:00:00Z', tokenUsage: { promptTokens: 200, completionTokens: 100 } },
      ],
    }] as any

    const from = Date.parse('2026-06-28T00:00:00Z')
    const agg = aggregateUsage(conversations, [], from)
    expect(agg.totalMessages).toBe(1) // only m2 (>= 2026-06-28)
    expect(agg.totalTokens).toBe(300)
  })
})

describe('aggregateByDay', () => {
  it('groups assistant usage by UTC day', () => {
    const conversations = [{
      id: 'c1', documentId: 'd1', createdAt: '', updatedAt: '',
      messages: [
        { id: 'm1', role: 'assistant', content: '', modelId: 'gpt-5.5', createdAt: '2026-06-28T10:00:00Z', tokenUsage: { promptTokens: 100, completionTokens: 50 } },
        { id: 'm2', role: 'assistant', content: '', modelId: 'gpt-5.5', createdAt: '2026-06-28T15:00:00Z', tokenUsage: { promptTokens: 50, completionTokens: 20 } },
        { id: 'm3', role: 'assistant', content: '', modelId: 'gpt-5.5', createdAt: '2026-06-29T10:00:00Z', tokenUsage: { promptTokens: 200, completionTokens: 100 } },
      ],
    }] as any

    const daily = aggregateByDay(conversations, [])
    expect(daily).toHaveLength(2)
    expect(daily[0].date).toBe('2026-06-28')
    expect(daily[0].tokens).toBe(220) // (100+50) + (50+20)
    expect(daily[0].messages).toBe(2)
    expect(daily[1].date).toBe('2026-06-29')
    expect(daily[1].tokens).toBe(300)
  })

  it('respects the fromMs time filter', () => {
    const conversations = [{
      id: 'c1', documentId: 'd1', createdAt: '', updatedAt: '',
      messages: [
        { id: 'm1', role: 'assistant', content: '', createdAt: '2026-06-01T00:00:00Z', tokenUsage: { promptTokens: 10, completionTokens: 5 } },
        { id: 'm2', role: 'assistant', content: '', createdAt: '2026-06-29T00:00:00Z', tokenUsage: { promptTokens: 20, completionTokens: 10 } },
      ],
    }] as any

    const daily = aggregateByDay(conversations, [], Date.parse('2026-06-28T00:00:00Z'))
    expect(daily).toHaveLength(1)
    expect(daily[0].date).toBe('2026-06-29')
  })
})
