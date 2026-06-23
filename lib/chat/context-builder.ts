/**
 * M4 自动 Context 注入
 *
 * buildSystemPrompt: 按顺序拼接 [系统指令] → [元数据摘要] → [正文全文]
 * 严禁对正文做任何截断（No Truncation 约束）。
 */

import type { ExtractionResult, PageMetadata } from '@/lib/db/types'

/**
 * 系统角色基础指令。
 */
const BASE_SYSTEM_INSTRUCTION = `你是一位专业的阅读助理，帮助用户深度理解和分析当前网页内容。
请基于下方提供的页面全文进行回答，优先引用原文内容支持你的观点。
如果问题超出文章范围，请明确说明并给出你自己的判断。
回答语言应与用户问题保持一致。`

/**
 * 将 PageMetadata 格式化为 Markdown 摘要。
 */
function formatMetadata(meta: PageMetadata, extra: { title: string; url: string; wordCount: number; engine: string }): string {
  const lines: string[] = []
  lines.push(`## 页面元数据`)
  lines.push(`- **标题**：${extra.title || '（未知）'}`)
  if (meta.author) lines.push(`- **作者**：${meta.author}`)
  if (meta.published) lines.push(`- **发布时间**：${meta.published}`)
  lines.push(`- **来源 URL**：${extra.url}`)
  lines.push(`- **字数统计**：约 ${extra.wordCount.toLocaleString()} 字`)
  lines.push(`- **提取引擎**：${extra.engine}`)
  if (meta.description) lines.push(`- **摘要**：${meta.description}`)
  if (meta.ogTitle && meta.ogTitle !== extra.title) lines.push(`- **OG 标题**：${meta.ogTitle}`)
  if (meta.schemaType) lines.push(`- **页面类型**：${meta.schemaType}`)
  return lines.join('\n')
}

/**
 * 构建注入 LLM 的 system prompt。
 *
 * 注入顺序：
 *   1. [系统角色指令]
 *   2. [页面元数据摘要 Markdown]
 *   3. [正文全文]
 *
 * 不对正文做任何截断。
 */
export function buildSystemPrompt(
  extraction: Pick<ExtractionResult, 'title' | 'url' | 'wordCount' | 'engine' | 'metadata' | 'markdownText' | 'rawText'>,
): string {
  const metaSummary = formatMetadata(extraction.metadata, {
    title: extraction.title,
    url: extraction.url,
    wordCount: extraction.wordCount,
    engine: extraction.engine,
  })

  const fullText = extraction.markdownText || extraction.rawText

  return [
    BASE_SYSTEM_INSTRUCTION,
    '',
    metaSummary,
    '',
    '## 页面全文',
    '',
    fullText,
  ].join('\n')
}

/**
 * 将 chat history 转换为 Message 数组格式（用于 chatStream messages 参数）。
 * system prompt 已在 buildSystemPrompt 中构建，此处仅返回 user/assistant 历史。
 */
export interface SimpleMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export function buildChatMessages(
  systemPrompt: string,
  history: SimpleMessage[],
  newUserMessage: string,
): SimpleMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    ...history.filter((m) => m.role !== 'system'),
    { role: 'user', content: newUserMessage },
  ]
}
