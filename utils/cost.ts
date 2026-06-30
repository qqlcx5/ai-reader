import type { ModelConfig } from '@/types/model'
import type { ConversationEntity } from '@/types/chat'
import { resolvePricing } from '@/data/model-pricing'

/**
 * Effective per-1M-token CNY price for a model.
 * Priority: manual override (ModelConfig.inputPricePer1M / outputPricePer1M)
 * > built-in pricing table > undefined (not priced, e.g. local Ollama models).
 */
export function getModelPricing(
  model: Pick<ModelConfig, 'modelId' | 'inputPricePer1M' | 'outputPricePer1M'>,
): { input: number; output: number } | undefined {
  if (model.inputPricePer1M != null && model.outputPricePer1M != null) {
    return { input: model.inputPricePer1M, output: model.outputPricePer1M }
  }
  return resolvePricing(model.modelId)
}

/**
 * Cost (CNY) for a single message, or undefined when the model has no pricing.
 * cost = promptTokens × input/1e6 + completionTokens × output/1e6
 */
export function calcMessageCost(
  usage: { promptTokens?: number; completionTokens?: number },
  model: Pick<ModelConfig, 'modelId' | 'inputPricePer1M' | 'outputPricePer1M'>,
): number | undefined {
  const pricing = getModelPricing(model)
  if (!pricing) return undefined
  const prompt = usage.promptTokens ?? 0
  const completion = usage.completionTokens ?? 0
  if (prompt === 0 && completion === 0) return 0
  return (prompt * pricing.input + completion * pricing.output) / 1e6
}

/** Compact token count label, e.g. 1500 → "1.5k", 150000 → "150k". */
export function formatTokens(n: number): string {
  if (n >= 100_000) return Math.round(n / 1000) + 'k'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

/** CNY cost label, trimming trailing zeros for tiny amounts. */
export function formatCNY(n: number): string {
  if (n <= 0) return '¥0'
  if (n < 0.01) return '¥' + n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
  return '¥' + n.toFixed(2)
}

export interface UsageByModel {
  modelId: string
  name: string
  promptTokens: number
  completionTokens: number
  cost: number
}

export interface UsageAggregate {
  byModel: UsageByModel[]
  totalPrompt: number
  totalCompletion: number
  totalCost: number
  totalTokens: number
}

/**
 * Aggregate assistant token usage + cost across ALL conversations.
 * Pure derivation over data fetched from the DB (e.g. findAllSorted),
 * so the result covers every document — not just the currently open one.
 */
export function aggregateUsage(
  conversations: ConversationEntity[],
  models: ModelConfig[],
): UsageAggregate {
  const byModel = new Map<string, UsageByModel>()
  let totalPrompt = 0
  let totalCompletion = 0
  let totalCost = 0

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role !== 'assistant' || !msg.tokenUsage) continue
      const u = msg.tokenUsage
      const p = u.promptTokens ?? 0
      const c = u.completionTokens ?? 0
      const model = models.find((m) => m.modelId === msg.modelId)
      const cost = model ? (calcMessageCost(u, model) ?? 0) : 0
      totalPrompt += p
      totalCompletion += c
      totalCost += cost
      const key = msg.modelId || 'unknown'
      const entry = byModel.get(key) ?? {
        modelId: key,
        name: model?.name || key,
        promptTokens: 0,
        completionTokens: 0,
        cost: 0,
      }
      entry.promptTokens += p
      entry.completionTokens += c
      entry.cost += cost
      byModel.set(key, entry)
    }
  }

  return {
    byModel: [...byModel.values()].sort((a, b) => b.cost - a.cost),
    totalPrompt,
    totalCompletion,
    totalCost,
    totalTokens: totalPrompt + totalCompletion,
  }
}
