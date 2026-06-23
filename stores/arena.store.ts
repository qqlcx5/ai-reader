/**
 * M4 Arena Store — 管理每个 Provider 的流式状态
 *
 * 每次发送消息时，为每个勾选的 Provider 创建独立的 ProviderSlot，
 * 追踪 streaming / done / error / aborted 状态与实时指标。
 */

import { ref, computed, reactive } from 'vue'
import { defineStore } from 'pinia'
import type { RequestMetrics, ProviderError } from '@/lib/providers/types'

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export type SlotStatus = 'idle' | 'streaming' | 'done' | 'error' | 'aborted'

export interface ProviderSlot {
  engineId: string
  name: string
  /** 厂商色点颜色 */
  color: string
  status: SlotStatus
  /** 累积的流式文本 */
  text: string
  /** 最终指标（流式结束后填入） */
  metrics: RequestMetrics | null
  /** 错误信息（status === 'error' 时填入） */
  error: ProviderError | null
  /** L3 缓存命中 */
  cached: boolean
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useArenaStore = defineStore('arena', () => {
  /** key = engineId，value = ProviderSlot */
  const slots = reactive<Map<string, ProviderSlot>>(new Map())

  /** 是否有任意 Provider 正在流式输出 */
  const isAnyStreaming = computed(() => {
    for (const slot of slots.values()) {
      if (slot.status === 'streaming') return true
    }
    return false
  })

  /** 所有 slot 列表（有序） */
  const slotList = computed<ProviderSlot[]>(() => Array.from(slots.values()))

  // ─── 操作 ───────────────────────────────────────────────────────────────────

  /**
   * 初始化一批 Provider slots（发送消息前调用）。
   * 会清空之前的 slots。
   */
  function initSlots(providers: Array<{ engineId: string; name: string; color?: string }>): void {
    slots.clear()
    for (const p of providers) {
      slots.set(p.engineId, {
        engineId: p.engineId,
        name: p.name,
        color: p.color ?? providerColor(p.engineId),
        status: 'idle',
        text: '',
        metrics: null,
        error: null,
        cached: false,
      })
    }
  }

  /** 标记 Provider 开始流式 */
  function setStreaming(engineId: string): void {
    const slot = slots.get(engineId)
    if (!slot) return
    slot.status = 'streaming'
    slot.text = ''
    slot.metrics = null
    slot.error = null
    slot.cached = false
  }

  /** 追加增量文本 */
  function appendDelta(engineId: string, delta: string): void {
    const slot = slots.get(engineId)
    if (!slot) return
    slot.text += delta
  }

  /** 标记完成并记录指标 */
  function setDone(engineId: string, metrics: RequestMetrics): void {
    const slot = slots.get(engineId)
    if (!slot) return
    slot.status = 'done'
    slot.metrics = metrics
    slot.cached = metrics.cached ?? false
  }

  /** 标记错误 */
  function setError(engineId: string, err: ProviderError): void {
    const slot = slots.get(engineId)
    if (!slot) return
    slot.status = 'error'
    slot.error = err
  }

  /** 标记中止 */
  function setAborted(engineId: string): void {
    const slot = slots.get(engineId)
    if (!slot) return
    slot.status = 'aborted'
  }

  /** 全部 abort（所有正在流式的 Provider） */
  function abortAll(): void {
    for (const slot of slots.values()) {
      if (slot.status === 'streaming' || slot.status === 'idle') {
        slot.status = 'aborted'
      }
    }
  }

  /** 清空所有 slots */
  function clearSlots(): void {
    slots.clear()
  }

  return {
    slots,
    slotList,
    isAnyStreaming,
    initSlots,
    setStreaming,
    appendDelta,
    setDone,
    setError,
    setAborted,
    abortAll,
    clearSlots,
  }
})

// ─── 厂商色点映射 ──────────────────────────────────────────────────────────────

export function providerColor(engineId: string): string {
  const colorMap: Record<string, string> = {
    openai: '#10a37f',
    anthropic: '#cc785c',
    gemini: '#248a52',
    deepseek: '#5b60e5',
    groq: '#f55036',
    cerebras: '#ca7a15',
    perplexity: '#20808d',
    xai: '#1a1a1a',
    moonshot: '#5b60e5',
    minimax: '#5b60e5',
    cohere: '#d14343',
    azure: '#0078d4',
    lmstudio: '#ca7a15',
    ollama: '#ca7a15',
    'chatgpt-web': '#10a37f',
  }
  return colorMap[engineId] ?? '#5b60e5'
}
