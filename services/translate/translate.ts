/**
 * AI document translation with paragraph-level alignment.
 *
 * Protocol: the document is split into blocks (blank-line separated, code
 * fences kept whole). Each batch is sent with ⟦N⟧ markers; the model must
 * return the same markers so translations can be mapped back to their
 * original blocks. Untranslated/missing blocks fall back to the original text,
 * so a partial failure degrades gracefully instead of losing content.
 */
import type { ModelConfig } from '@/types/model'
import type { DocumentEntity } from '@/types/document'
import type { AIProvider } from '@/services/ai/types'
import { createProvider } from '@/services/ai/factory'
import { estimateTokens } from '@/utils/token'

const MARK_OPEN = '\u27e6'  // ⟦
const MARK_CLOSE = '\u27e7' // ⟧
const MARK_RE = /\u27e6(\d+)\u27e7/g

/** Rough token budget per translation call (leaves room for the response). */
const BATCH_TOKENS = 2200

export interface DocumentTranslation {
  lang: string
  markdown: string
  translatedAt: string
}

/**
 * Split markdown into blocks on blank lines, keeping fenced code blocks whole
 * (they may contain blank lines).
 */
export function splitBlocks(markdown: string): string[] {
  const lines = markdown.split('\n')
  const blocks: string[] = []
  let current: string[] = []
  let inFence = false

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    if (!inFence && line.trim() === '' && current.length > 0) {
      blocks.push(current.join('\n'))
      current = []
    } else {
      current.push(line)
    }
  }
  if (current.length > 0) blocks.push(current.join('\n'))
  return blocks.filter((b) => b.trim() !== '')
}

/** Parse model output back into (blockIndex → translatedText | null). */
export function parseTranslatedBlocks(raw: string): Map<number, string> {
  const map = new Map<number, string>()
  MARK_RE.lastIndex = 0
  const matches = [...raw.matchAll(MARK_RE)]
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length
    const text = raw.slice(start, end).replace(/^\s*\n/, '').replace(/\s+$/, '')
    const idx = Number(m[1])
    if (!Number.isNaN(idx) && text.trim() !== '') map.set(idx, text.trim())
  }
  return map
}

function buildSystemPrompt(targetLang: string): string {
  return `你是一个专业翻译引擎。用户会给你若干带 ⟦编号⟧ 标记的 Markdown 段落，请把它们翻译成${targetLang}。

要求：
- 输出必须保留每段开头的 ⟦编号⟧ 标记，编号与输入一一对应，不要增删或合并段落
- 保留 Markdown 格式（标题层级、加粗、链接、列表等）
- 代码块原样返回，不翻译
- 只输出翻译结果，不要任何解释`
}

/** Pick a sensible default target language from the source content. */
export function defaultTargetLang(text: string): string {
  return /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(text) ? 'English' : '中文'
}

export interface TranslateOptions {
  document: DocumentEntity
  model: ModelConfig
  targetLang: string
  signal?: AbortSignal
  provider?: AIProvider
  /** Called after each batch with (doneBlocks, totalBlocks). */
  onProgress?: (done: number, total: number) => void
}

/**
 * Translate a document block-by-block. Returns the aligned translation —
 * untranslated blocks keep their original text. Throws only when every batch
 * fails.
 */
export async function translateDocument(options: TranslateOptions): Promise<DocumentTranslation> {
  const { document, model, targetLang, signal, provider, onProgress } = options
  const provider_ = provider ?? createProvider(model)

  const blocks = splitBlocks(document.markdown || '')
  if (blocks.length === 0) throw new Error('文档没有可翻译的内容')

  // Batch blocks within a token budget.
  const batches: number[][] = []
  let current: number[] = []
  let currentTokens = 0
  blocks.forEach((block, i) => {
    const cost = estimateTokens(block) + 20
    if (current.length > 0 && currentTokens + cost > BATCH_TOKENS) {
      batches.push(current)
      current = []
      currentTokens = 0
    }
    current.push(i)
    currentTokens += cost
  })
  if (current.length > 0) batches.push(current)

  const translated = new Map<number, string>()
  let batchesFailed = 0

  for (const batch of batches) {
    const payload = batch
      .map((i) => `${MARK_OPEN}${i}${MARK_CLOSE}\n${blocks[i]}`)
      .join('\n\n')
    try {
      const output = await provider_.chat({
        model,
        systemPrompt: buildSystemPrompt(targetLang),
        messages: [{ role: 'user', content: payload }],
        signal,
      })
      const parsed = parseTranslatedBlocks(output.content)
      for (const i of batch) {
        const t = parsed.get(i)
        if (t != null) translated.set(i, t)
      }
    } catch {
      batchesFailed++
    }
    onProgress?.(batchEndCount(batches, batch, blocks.length), blocks.length)
  }

  if (translated.size === 0 && batchesFailed === batches.length) {
    throw new Error('翻译失败：所有请求都没有成功')
  }

  const merged = blocks.map((block, i) => translated.get(i) ?? block).join('\n\n')
  return { lang: targetLang, markdown: merged, translatedAt: new Date().toISOString() }
}

/** How many blocks are accounted for after `batch` completes (best-effort progress). */
function batchEndCount(batches: number[][], batch: number[], total: number): number {
  const idx = batches.indexOf(batch)
  const done = batches.slice(0, idx + 1).reduce((s, b) => s + b.length, 0)
  return Math.min(done, total)
}
