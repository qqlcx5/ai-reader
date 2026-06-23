/**
 * M8 存储与数据层 — Context Pinia Store
 *
 * 存储当前锚定页面的提取结果（ExtractionResult | null）。
 * 跨 Tab 切换时保持不变（静默锚定机制）：用户切换 Tab 时上下文不自动刷新，
 * 只有用户主动点击「刷新提取」才更新 currentContext。
 *
 * currentPageId 用于快速判断当前上下文对应的页面，无需解构 ExtractionResult。
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ExtractionResult, ContextMode } from '@/lib/db/types'

export const useContextStore = defineStore('context', () => {
  /** 当前锚定页面的完整提取结果；null 表示尚未提取 */
  const currentContext = ref<ExtractionResult | null>(null)

  /** 当前锚定页面的 pageId（SHA-256 of normalizedUrl），与 currentContext?.pageId 同步 */
  const currentPageId = ref<string | null>(null)

  /** 上下文注入模式（summary / full / selected / relay） */
  const mode = ref<ContextMode>('full')

  // ─── 派生状态 ─────────────────────────────────────────────────────────────

  const hasContext = computed(() => currentContext.value !== null)

  const contextTitle = computed(() => currentContext.value?.title ?? '')

  const contextWordCount = computed(() => currentContext.value?.wordCount ?? 0)

  const contextEngine = computed(() => currentContext.value?.engine ?? null)

  // ─── 操作 ─────────────────────────────────────────────────────────────────

  /**
   * 主动更新上下文（用户点击「刷新提取」或首次提取完成时调用）。
   * 接受 Partial<ExtractionResult>（兼容 M1/M4 组件在 M2 完整实现前的局部调用），
   * 必须提供 url；其余字段填写合理默认值。
   */
  function setContext(result: Partial<ExtractionResult> & { url: string }): void {
    let hostname = ''
    try {
      hostname = new URL(result.url).hostname
    } catch {
      hostname = result.url
    }
    const full: ExtractionResult = {
      pageId: result.pageId ?? '',
      url: result.url,
      title: result.title ?? '',
      favicon: result.favicon,
      domain: result.domain ?? hostname,
      rawText: result.rawText ?? result.fullText ?? '',
      markdownText: result.markdownText,
      fullText: result.fullText,
      excerpt: result.excerpt,
      metadata: result.metadata ?? {},
      wordCount: result.wordCount ?? 0,
      engine: result.engine ?? 'fallback',
      mode: result.mode,
      extractedAt: result.extractedAt ?? Date.now(),
    }
    currentContext.value = full
    currentPageId.value = full.pageId
  }

  function setMode(m: ContextMode): void {
    mode.value = m
  }

  /**
   * 静默锚定检查：切换 Tab 时调用，若 activeTabUrl 与当前锚定不同，
   * 仅记录日志，不自动覆盖 currentContext（静默锚定机制）。
   * 返回 true 表示锚定未变（已在当前页），false 表示已静默锚定。
   */
  function checkAnchor(activeTabUrl: string): boolean {
    if (!currentContext.value) return false
    return currentContext.value.url === activeTabUrl
  }

  /** 清除上下文（用户手动解绑或切换到新的工作区） */
  function clearContext(): void {
    currentContext.value = null
    currentPageId.value = null
  }

  return {
    currentContext,
    currentPageId,
    mode,
    hasContext,
    contextTitle,
    contextWordCount,
    contextEngine,
    setContext,
    setMode,
    checkAnchor,
    clearContext,
  }
})
