/**
 * AI summaries for page-watch changes: given the previous and current
 * excerpts, produce a one-or-two-sentence "what changed". Best-effort —
 * failures leave the change record without a summary.
 */
import type { ModelConfig } from '@/types/model'
import type { AIProvider } from '@/services/ai/types'
import { createProvider } from '@/services/ai/factory'
import { ModelRepository } from '@/db/repositories/model.repository'
import type { PageWatchEntity } from '@/types/page-watch'

const SUMMARY_PROMPT = `你是网页变更分析助手。用户给你同一页面的旧版与新版正文摘录，请用 1~2 句话概括发生了什么变化（新增了什么/删除了什么/改了什么）。

要求：
- 只依据给出的材料，不要编造
- 直接输出概括，不要任何前缀或解释
- 用材料的语言
- 如果两版几乎相同（可能是页面模板噪声），就输出「内容基本未变，仅有排版或动态元素更新」`

export function buildChangeMaterial(previous: string, current: string): string {
  return `【旧版摘录】\n${previous.slice(0, 1500) || '（空）'}\n\n【新版摘录】\n${current.slice(0, 1500) || '（空）'}`
}

/** Summarize one change; returns null on any failure. */
export async function summarizeChange(
  previous: string,
  current: string,
  model?: ModelConfig,
  provider?: AIProvider,
): Promise<string | null> {
  try {
    const model_ = model ?? (await ModelRepository.findDefault())
    if (!model_) return null
    const provider_ = provider ?? createProvider(model_)
    const output = await provider_.chat({
      model: model_,
      systemPrompt: SUMMARY_PROMPT,
      messages: [{ role: 'user', content: buildChangeMaterial(previous, current) }],
    })
    const text = output.content.trim()
    return text ? text.slice(0, 300) : null
  } catch {
    return null
  }
}

/**
 * Fill in summaries for a watch's latest change (which stores the previous
 * excerpt) using the watch's current excerpt. Persists best-effort.
 */
export async function annotateLatestChange(watch: PageWatchEntity): Promise<PageWatchEntity | null> {
  const latest = watch.changes?.[0]
  if (!latest?.previousExcerpt || latest.summary || !watch.lastMarkdownExcerpt) return null
  const summary = await summarizeChange(latest.previousExcerpt, watch.lastMarkdownExcerpt)
  if (!summary) return null
  const changes = [...(watch.changes ?? [])]
  changes[0] = { ...changes[0], summary }
  const updated = { ...watch, changes }
  const { PageWatchRepository } = await import('./watch')
  await PageWatchRepository.save(updated)
  return updated
}
