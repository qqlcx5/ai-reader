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
  /** Total assistant messages for this model. */
  total: number
  /** Failed assistant messages (status === 'failed'). */
  failed: number
  /** failed / total. */
  errorRate: number
  /** Mean generation time over messages that recorded durationMs (ms). */
  avgDurationMs: number
}

export interface UsageAggregate {
  byModel: UsageByModel[]
  totalPrompt: number
  totalCompletion: number
  totalCost: number
  totalTokens: number
  /** Total assistant messages. */
  totalMessages: number
  failedMessages: number
  errorRate: number
  avgDurationMs: number
}

interface AccModel {
  modelId: string
  name: string
  promptTokens: number
  completionTokens: number
  cost: number
  total: number
  failed: number
  durationSum: number
  durationCount: number
}

/**
 * Aggregate assistant token usage, cost, latency and error rate across ALL
 * conversations. Pure derivation over data fetched from the DB (e.g.
 * findAllSorted), so the result covers every document — not just the open one.
 */
export function aggregateUsage(
  conversations: ConversationEntity[],
  models: ModelConfig[],
): UsageAggregate {
  const byModel = new Map<string, AccModel>()
  let totalPrompt = 0
  let totalCompletion = 0
  let totalCost = 0
  let totalMessages = 0
  let failedMessages = 0
  let durationSum = 0
  let durationCount = 0

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role !== 'assistant') continue
      totalMessages++
      const failed = msg.status === 'failed'
      if (failed) failedMessages++

      const key = msg.modelId || 'unknown'
      const model = models.find((m) => m.modelId === msg.modelId)
      let entry = byModel.get(key)
      if (!entry) {
        entry = {
          modelId: key,
          name: model?.name || key,
          promptTokens: 0,
          completionTokens: 0,
          cost: 0,
          total: 0,
          failed: 0,
          durationSum: 0,
          durationCount: 0,
        }
        byModel.set(key, entry)
      }
      entry.total++
      if (failed) entry.failed++
      if (msg.durationMs != null) {
        entry.durationSum += msg.durationMs
        entry.durationCount++
        durationSum += msg.durationMs
        durationCount++
      }
      if (msg.tokenUsage) {
        const p = msg.tokenUsage.promptTokens ?? 0
        const c = msg.tokenUsage.completionTokens ?? 0
        const cost = model ? (calcMessageCost(msg.tokenUsage, model) ?? 0) : 0
        entry.promptTokens += p
        entry.completionTokens += c
        entry.cost += cost
        totalPrompt += p
        totalCompletion += c
        totalCost += cost
      }
    }
  }

  const toByModel = (e: AccModel): UsageByModel => ({
    modelId: e.modelId,
    name: e.name,
    promptTokens: e.promptTokens,
    completionTokens: e.completionTokens,
    cost: e.cost,
    total: e.total,
    failed: e.failed,
    errorRate: e.total > 0 ? e.failed / e.total : 0,
    avgDurationMs: e.durationCount > 0 ? Math.round(e.durationSum / e.durationCount) : 0,
  })

  return {
    byModel: [...byModel.values()].map(toByModel).sort((a, b) => b.cost - a.cost),
    totalPrompt,
    totalCompletion,
    totalCost,
    totalTokens: totalPrompt + totalCompletion,
    totalMessages,
    failedMessages,
    errorRate: totalMessages > 0 ? failedMessages / totalMessages : 0,
    avgDurationMs: durationCount > 0 ? Math.round(durationSum / durationCount) : 0,
  }
}
