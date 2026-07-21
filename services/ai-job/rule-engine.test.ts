import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import { ruleMatches, findMatchingRule } from './rule-engine'
import type { AnalysisRuleEntity } from '@/types/analysis-rule'
import type { DocumentEntity } from '@/types/document'

function makeRule(overrides: Partial<AnalysisRuleEntity> = {}): AnalysisRuleEntity {
  return {
    id: 'r1',
    name: 'test',
    enabled: true,
    conditions: [],
    modelId: 'm1',
    promptTemplateId: 't1',
    priority: 'normal',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeDoc(overrides: Partial<DocumentEntity> = {}): DocumentEntity {
  return {
    id: 'd1',
    url: 'https://blog.example.com/post',
    title: 'T',
    markdown: 'x',
    wordCount: 500,
    tokenCount: 600,
    contentHash: 'h1',
    extractionMethod: 'manual',
    source: 'library',
    capturedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('rule engine', () => {
  beforeEach(async () => {
    await db.analysisRules.clear()
  })

  it('disabled rule never matches', () => {
    const rule = makeRule({ enabled: false })
    expect(ruleMatches(rule, makeDoc())).toBe(false)
  })

  it('rule with no conditions always matches', () => {
    expect(ruleMatches(makeRule(), makeDoc())).toBe(true)
  })

  it('domain contains matches on hostname substring', () => {
    const rule = makeRule({
      conditions: [{ field: 'domain', operator: 'contains', value: 'example.com' }],
    })
    expect(ruleMatches(rule, makeDoc({ url: 'https://blog.example.com/x' }))).toBe(true)
    expect(ruleMatches(rule, makeDoc({ url: 'https://other.com/x' }))).toBe(false)
  })

  it('siteName equals matches case-insensitively', () => {
    const rule = makeRule({
      conditions: [{ field: 'siteName', operator: 'equals', value: 'Hacker News' }],
    })
    expect(ruleMatches(rule, makeDoc({ siteName: 'hacker news' }))).toBe(true)
    expect(ruleMatches(rule, makeDoc({ siteName: 'Reddit' }))).toBe(false)
  })

  it('wordCount gt / lt compare numerically', () => {
    const gt = makeRule({
      conditions: [{ field: 'wordCount', operator: 'gt', value: '1000' }],
    })
    expect(ruleMatches(gt, makeDoc({ wordCount: 500 }))).toBe(false)
    expect(ruleMatches(gt, makeDoc({ wordCount: 1500 }))).toBe(true)

    const lt = makeRule({
      conditions: [{ field: 'wordCount', operator: 'lt', value: '200' }],
    })
    expect(ruleMatches(lt, makeDoc({ wordCount: 100 }))).toBe(true)
    expect(ruleMatches(lt, makeDoc({ wordCount: 300 }))).toBe(false)
  })

  it('multiple conditions are AND-ed', () => {
    const rule = makeRule({
      conditions: [
        { field: 'domain', operator: 'contains', value: 'example' },
        { field: 'wordCount', operator: 'gt', value: '100' },
      ],
    })
    expect(ruleMatches(rule, makeDoc({ url: 'https://example.com/x', wordCount: 50 }))).toBe(false)
    expect(ruleMatches(rule, makeDoc({ url: 'https://example.com/x', wordCount: 500 }))).toBe(true)
  })

  it('findMatchingRule returns first match in createdAt order', async () => {
    await db.analysisRules.put(makeRule({
      id: 'r-late', name: 'late',
      conditions: [{ field: 'wordCount', operator: 'gt', value: '100' }],
      createdAt: '2026-02-01T00:00:00Z',
    }))
    await db.analysisRules.put(makeRule({
      id: 'r-early', name: 'early',
      conditions: [{ field: 'wordCount', operator: 'gt', value: '100' }],
      createdAt: '2026-01-01T00:00:00Z',
    }))
    const match = await findMatchingRule(makeDoc({ wordCount: 500 }))
    expect(match?.id).toBe('r-early')
  })

  it('findMatchingRule returns undefined when nothing matches', async () => {
    await db.analysisRules.put(makeRule({
      conditions: [{ field: 'wordCount', operator: 'gt', value: '999999' }],
    }))
    const match = await findMatchingRule(makeDoc({ wordCount: 500 }))
    expect(match).toBeUndefined()
  })
})
