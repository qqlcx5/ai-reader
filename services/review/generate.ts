import type { ModelConfig } from '@/types/model'
import type { DocumentEntity } from '@/types/document'
import type { FlashcardEntity } from '@/types/flashcard'
import type { AIProvider } from '@/services/ai/types'
import { createProvider } from '@/services/ai/factory'
import { truncateContext } from '@/services/prompt/truncate'
import { initialSm2State } from '@/utils/sm2'
import { nowISO } from '@/utils/date'

/** Max cards produced in a single generation run. */
export const MAX_CARDS_PER_RUN = 8

/** Token budget for the source material sent to the model. */
const CONTEXT_TOKEN_BUDGET = 3000

export type FlashcardMode = 'qa' | 'cloze'

const QA_PROMPT = `你是一个闪卡（flashcard）制作助手。根据用户提供的材料制作间隔重复复习用的问答卡。

要求：
- 输出一个 JSON 数组，每个元素形如 {"front": "问题", "back": "答案"}，不要输出任何其他文字
- 制作 5~${MAX_CARDS_PER_RUN} 张卡，优先覆盖材料中的核心概念
- front 是一个明确、可独立理解的问题；back 是简短准确的答案（1~3 句）
- 用材料本身的语言作答；答案必须能从材料中找到依据，不要编造`

const CLOZE_PROMPT = `你是一个挖空卡（cloze deletion）制作助手。根据用户提供的材料制作填空卡。

要求：
- 输出一个 JSON 数组，每个元素形如 {"front": "句子（关键词替换为 ____）", "back": "被挖空的关键词"}，不要输出任何其他文字
- 制作 5~${MAX_CARDS_PER_RUN} 张卡，优先挖空材料中最重要的概念、术语、数字
- front 保留原句上下文，只挖掉一个关键信息，用连续四个下划线 ____ 表示
- back 就是被挖掉的那个词或短语，必须与原文完全一致
- 用材料本身的语言作答，不要编造`

export interface GenerateFlashcardsOptions {
  document: DocumentEntity
  model: ModelConfig
  /** Existing cards used to dedupe by question. */
  existing?: FlashcardEntity[]
  /** Question-answer cards (default) or cloze deletions. */
  mode?: FlashcardMode
  signal?: AbortSignal
  /** Override the provider (tests). */
  provider?: AIProvider
}

export interface GenerateFlashcardsResult {
  cards: FlashcardEntity[]
  /** Raw model output when parsing failed, for error reporting. */
  parseError?: string
}

/**
 * Generate flashcards for a document with a one-shot (non-streaming) AI call.
 * Prefers highlights as source material; falls back to the full markdown.
 * Never throws on unparsable output — returns an empty list + parseError.
 */
export async function generateFlashcards(options: GenerateFlashcardsOptions): Promise<GenerateFlashcardsResult> {
  const { document, model, existing = [], mode = 'qa', signal, provider } = options
  const provider_ = provider ?? createProvider(model)

  const material = buildSourceMaterial(document)
  if (!material) return { cards: [] }

  const output = await provider_.chat({
    model,
    systemPrompt: mode === 'cloze' ? CLOZE_PROMPT : QA_PROMPT,
    messages: [{ role: 'user', content: material }],
    signal,
  })

  const parsed = parseCards(output.content)
  if ('error' in parsed) return { cards: [], parseError: parsed.error }

  const existingFronts = new Set(existing.map((c) => normalizeFront(c.front)))
  const now = nowISO()
  const cards: FlashcardEntity[] = []
  for (const item of parsed.cards) {
    const key = normalizeFront(item.front)
    if (!key || existingFronts.has(key)) continue
    existingFronts.add(key)
    cards.push({
      id: crypto.randomUUID(),
      documentId: document.id,
      front: item.front,
      back: item.back,
      source: 'ai',
      type: mode,
      sm2: initialSm2State(),
      createdAt: now,
      updatedAt: now,
    })
    if (cards.length >= MAX_CARDS_PER_RUN) break
  }
  return { cards }
}

/** Highlights (with notes) when there are enough; otherwise truncated markdown. */
function buildSourceMaterial(document: DocumentEntity): string {
  const highlights = document.highlights ?? []
  const useful = highlights.filter((h) => h.text.trim().length >= 20)
  if (useful.length >= 3) {
    const lines = useful.map((h) => {
      const note = h.note?.trim()
      return note ? `- ${h.text.trim()}（笔记：${note}）` : `- ${h.text.trim()}`
    })
    return `文档标题：${document.title}\n\n以下是我在阅读时划的重点：\n${lines.join('\n')}`
  }
  const markdown = truncateContext(document.markdown, CONTEXT_TOKEN_BUDGET)
  if (!markdown.trim()) return ''
  return `文档标题：${document.title}\n\n${markdown}`
}

function normalizeFront(front: string): string {
  // Whitespace-insensitive comparison (CJK text often has stray spaces).
  return front.trim().toLowerCase().replace(/\s+/g, '')
}

type ParseResult = { cards: { front: string; back: string }[] } | { error: string }

/** Parse the model output as a JSON array, tolerating code fences and prose. */
export function parseCards(raw: string): ParseResult {
  if (!raw.trim()) return { error: '模型返回为空' }

  let text = raw.trim()
  // Strip a wrapping code fence if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fence) text = fence[1].trim()

  // Direct array, or array embedded in prose (first '[' to last ']').
  const candidates: string[] = [text]
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1))

  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate)
      if (!Array.isArray(data)) continue
      const cards = data
        .filter(
          (item): item is { front: string; back: string } =>
            item != null
            && typeof item === 'object'
            && typeof (item as any).front === 'string'
            && typeof (item as any).back === 'string'
            && (item as any).front.trim() !== ''
            && (item as any).back.trim() !== '',
        )
        .map((item) => ({ front: item.front.trim(), back: item.back.trim() }))
      if (cards.length > 0) return { cards }
    } catch {
      // try next candidate
    }
  }
  return { error: '无法解析模型输出为闪卡 JSON' }
}
