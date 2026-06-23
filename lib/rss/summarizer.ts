/**
 * M9 AI 后台摘要生成
 *
 * summarizeArticle: 使用 M3 IEngine 静默生成 3 句话摘要
 * - 超时 30s
 * - 失败降级：返回 description.slice(0, 200)
 * - 后台静默执行，不弹任何 UI
 */

import type { RawArticle } from './types'
import type { IEngine } from '@/lib/providers/types'

/**
 * 为单篇文章生成 AI 摘要。
 *
 * @param article  原始文章
 * @param engine   M3 IEngine 实例
 * @param apiKey   API Key
 * @param model    模型名称（如 'gpt-4o-mini'）
 */
export async function summarizeArticle(
  article: RawArticle,
  engine: IEngine,
  apiKey: string,
  model: string,
): Promise<string> {
  const prompt = `请用 3 句话（不超过 200 字）概括以下文章内容：\n\n${article.description}`
  let summary = ''

  try {
    await engine.chatStream({
      messages: [{ role: 'user', content: prompt }],
      model: model || 'gpt-4o-mini',
      apiKey,
      signal: AbortSignal.timeout(30000),
      onDelta: (text) => {
        summary += text
      },
      onMetrics: () => {},
      onError: (err) => {
        if (!err.retryable) {
          console.warn('[rss:summarizer] engine error', err.message)
        }
      },
    })

    const result = summary.trim()
    return result.length > 0 ? result : article.description.slice(0, 200)
  } catch {
    return article.description.slice(0, 200)
  }
}
