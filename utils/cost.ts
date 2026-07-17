import dayjs from 'dayjs'
import type { ModelConfig } from '@/types/model'
import type { ConversationEntity } from '@/types/chat'
import { resolvePricing } from '@/data/model-pricing'

/** Format milliseconds as a human-readable duration. */
export function formatMs(ms: number): string {
  if (ms <= 0) return '—'
  if (ms < 1000) return ms + 'ms'
  if (ms < 60_000) return (ms / 1000).toFixed(1) + 's'
  const min = Math.floor(ms / 60_000)
  const sec = Math.round((ms % 60_000) / 1000)
  return `${min}m${sec}s`
}

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
  /** Mean time to first token (ms). */
  avgFirstTokenMs: number
  /** Output tokens per second over messages with gen timing. */
  tokensPerSec: number
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
  avgFirstTokenMs: number
  tokensPerSec: number
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
  firstTokenSum: number
  firstTokenCount: number
  genSum: number
}

/**
 * Aggregate assistant token usage, cost, latency and error rate across ALL
 * conversations. Pure derivation over data fetched from the DB (e.g.
 * findAllSorted), so the result covers every document — not just the open one.
 */
export function aggregateUsage(
  conversations: ConversationEntity[],
  models: ModelConfig[],
  fromMs?: number,
): UsageAggregate {
  const byModel = new Map<string, AccModel>()
  let totalPrompt = 0
  let totalCompletion = 0
  let totalCost = 0
  let totalMessages = 0
  let failedMessages = 0
  let durationSum = 0
  let durationCount = 0
  let totalFirstTokenSum = 0
  let totalFirstTokenCount = 0
  let totalGenSum = 0

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role !== 'assistant') continue
      if (fromMs != null && msg.createdAt) {
        const t = dayjs(msg.createdAt).valueOf()
        if (!Number.isNaN(t) && t < fromMs) continue
      }
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
          firstTokenSum: 0,
          firstTokenCount: 0,
          genSum: 0,
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
      if (msg.firstTokenMs != null) {
        entry.firstTokenSum += msg.firstTokenMs
        entry.firstTokenCount++
        totalFirstTokenSum += msg.firstTokenMs
        totalFirstTokenCount++
      }
      if (msg.genMs != null) {
        entry.genSum += msg.genMs
        totalGenSum += msg.genMs
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
    avgFirstTokenMs: e.firstTokenCount > 0 ? Math.round(e.firstTokenSum / e.firstTokenCount) : 0,
    tokensPerSec: e.genSum > 0 ? Math.round(e.completionTokens / (e.genSum / 1000)) : 0,
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
    avgFirstTokenMs: totalFirstTokenCount > 0 ? Math.round(totalFirstTokenSum / totalFirstTokenCount) : 0,
    tokensPerSec: totalGenSum > 0 ? Math.round(totalCompletion / (totalGenSum / 1000)) : 0,
  }
}

export interface DailyUsage {
  /** YYYY-MM-DD (UTC). */
  date: string
  tokens: number
  cost: number
  messages: number
}

/** Group assistant usage by UTC day. Only days with data are returned, sorted ascending. */
export function aggregateByDay(
  conversations: ConversationEntity[],
  models: ModelConfig[],
  fromMs?: number,
): DailyUsage[] {
  const map = new Map<string, DailyUsage>()
  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role !== 'assistant' || !msg.createdAt) continue
      const t = dayjs(msg.createdAt).valueOf()
      if (Number.isNaN(t)) continue
      if (fromMs != null && t < fromMs) continue
      const date = dayjs(t).toISOString().slice(0, 10)
      let entry = map.get(date)
      if (!entry) {
        entry = { date, tokens: 0, cost: 0, messages: 0 }
        map.set(date, entry)
      }
      entry.messages++
      if (msg.tokenUsage) {
        entry.tokens += (msg.tokenUsage.promptTokens ?? 0) + (msg.tokenUsage.completionTokens ?? 0)
        const model = models.find((m) => m.modelId === msg.modelId)
        entry.cost += model ? (calcMessageCost(msg.tokenUsage, model) ?? 0) : 0
      }
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}
