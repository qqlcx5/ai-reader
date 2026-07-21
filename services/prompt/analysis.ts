import type { ContextSettings } from '@/types/settings'
import type { Highlight } from '@/types/document'
import type { ModelConfig } from '@/types/model'
import { buildPageContext, buildHighlightContext } from './context'
import { truncateContext } from './truncate'
import { PromptBuilder, type PromptOutput } from './builder'

export interface PageDoc {
  title: string
  url: string
  markdown: string
  wordCount: number
  tokenCount: number
  siteName?: string
  capturedAt?: string
}

export interface BuildPromptInput {
  /** The model being used — provides per-model systemPrompt. */
  model: ModelConfig
  /** Fallback system prompt when the model has none (settings.globalSystemPrompt). */
  fallbackSystemPrompt?: string
  /** Prompt template content (the "user instruction"). Empty string when no template. */
  promptTemplateContent?: string
  /** Page context settings — controls what metadata is included + token budget. */
  contextSettings?: ContextSettings
  /** The document to analyze. When omitted, no page context is attached. */
  page?: PageDoc
  /** User highlights to append as supplementary context. */
  highlights?: Highlight[]
  /** Interactive-question path only: prior turns. Queue path omits this. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  /** Interactive-question path only: the user's typed question. */
  userInput?: string
}

export interface BuildPromptResult extends PromptOutput {
  /** The final user-turn content (context + question), persisted as the user message. */
  sentUserContent: string
}

/**
 * Single source of truth for assembling an analysis prompt.
 *
 * Used by both the background queue processor (services/ai-job/processor.ts)
 * and the interactive chat store (stores/chat.store.ts). Keeping this in one
 * place means prompt-shape changes (adding RAG, few-shot, etc.) land once.
 *
 * History is only attached when the caller provides it (interactive path).
 * The queue path passes no history — each analysis is a fresh one-shot.
 */
export function buildAnalysisPrompt(input: BuildPromptInput): BuildPromptResult {
  // 1. Build page context (metadata + markdown), honoring settings.
  let context: string | undefined
  if (input.page?.markdown) {
    const max = input.contextSettings?.maxContextTokens ?? 1_050_000
    let ctx = buildPageContext(input.page, input.contextSettings)
    if (input.highlights?.length) {
      ctx += buildHighlightContext(input.highlights)
    }
    context = truncateContext(ctx, max)
  }

  // 2. Resolve system prompt: model overrides global.
  const system = input.model.systemPrompt?.trim() || input.fallbackSystemPrompt?.trim() || undefined

  // 3. Prompt template content is the "user instruction" for auto-analysis.
  //    In interactive mode the user's typed question takes that slot instead.
  const userInput = input.userInput?.trim() || input.promptTemplateContent?.trim() || ''

  const out = new PromptBuilder().build({
    systemPrompt: system,
    context,
    history: input.history,
    userInput,
  })

  // The final user turn = context + instruction joined by PromptBuilder.
  const sentUserContent = [...out.messages].reverse().find((m) => m.role === 'user')?.content ?? userInput

  return { ...out, sentUserContent }
}
