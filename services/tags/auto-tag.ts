/**
 * AI auto-tagging — one-shot call suggesting 3–5 short tags when a document
 * is captured. Opt-in via settings; best-effort (never blocks capture).
 */
import type { ModelConfig } from '@/types/model'
import type { DocumentEntity } from '@/types/document'
import type { AIProvider } from '@/services/ai/types'
import { createProvider } from '@/services/ai/factory'
import { truncateContext } from '@/services/prompt/truncate'
import { ModelRepository } from '@/db/repositories/model.repository'
import { SettingsRepository } from '@/db/repositories/settings.repository'
import { DocumentRepository } from '@/db/repositories/document.repository'

const SYSTEM_PROMPT = `你是一个文档标签助手。根据用户提供的文档内容，给出 3~5 个简短的主题标签。

要求：
- 输出一个 JSON 字符串数组，例如 ["机器学习","教程"]，不要输出任何其他文字
- 每个标签 2~6 个字，使用与文档相同的语言
- 标签要具体（如"Transformer"），避免过于宽泛（如"技术"）
- 只使用文档中实际涉及的主题，不要编造`

/** Parse the model output as a string array (tolerates fences/prose). */
export function parseTags(raw: string): string[] {
  if (!raw.trim()) return []
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fence) text = fence[1].trim()

  const candidates: string[] = [text]
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1))

  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate)
      if (!Array.isArray(data)) continue
      const tags = data
        .filter((t): t is string => typeof t === 'string' && t.trim().length >= 1)
        .map((t) => t.trim().slice(0, 20))
      if (tags.length > 0) return tags.slice(0, 5)
    } catch {
      // try next candidate
    }
  }
  return []
}

export interface SuggestTagsOptions {
  document: DocumentEntity
  model: ModelConfig
  existing?: string[]
  signal?: AbortSignal
  provider?: AIProvider
}

/** Suggest tags for a document. Returns [] on any failure (best-effort). */
export async function suggestTags(options: SuggestTagsOptions): Promise<string[]> {
  const { document, model, existing = [], signal, provider } = options
  const provider_ = provider ?? createProvider(model)

  const material = [
    `标题：${document.title || '(无标题)'}`,
    document.excerpt ? `摘要：${document.excerpt}` : '',
    truncateContext(document.markdown || '', 1500),
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const output = await provider_.chat({
      model,
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: material }],
      signal,
    })
    const seen = new Set(existing.map((t) => t.toLowerCase()))
    return parseTags(output.content).filter((t) => {
      const key = t.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  } catch {
    return []
  }
}

/**
 * Post-capture hook: when auto-tagging is enabled and a default model exists,
 * generate tags and persist them onto the document. Returns the tags applied.
 */
export async function maybeAutoTag(documentId: string): Promise<string[]> {
  try {
    const settings = await SettingsRepository.get()
    if (!settings?.tagging?.autoTagOnCapture) return []

    const model = await ModelRepository.findDefault()
    if (!model) return []

    const doc = await DocumentRepository.findById(documentId)
    if (!doc) return []

    const tags = await suggestTags({ document: doc, model, existing: doc.tags ?? [] })
    if (tags.length === 0) return []

    await DocumentRepository.save({ ...doc, tags: [...(doc.tags ?? []), ...tags] })
    return tags
  } catch {
    return []
  }
}
