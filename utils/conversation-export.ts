import dayjs from 'dayjs'
/**
 * Conversation export utilities.
 *
 * Supports:
 * - Single conversation → Markdown (with metadata header + thinking content)
 * - Single conversation → JSON (full fidelity)
 * - Batch export → ZIP of Markdown files (by document or time range)
 * - Copy single message as Markdown
 */

import { zipSync, strToU8 } from 'fflate'
import type { ConversationEntity, ChatMessage } from '@/types/chat'
import type { DocumentEntity } from '@/types/document'
import { formatMs, formatTokens, formatCNY } from './cost'

// ── Helpers ────────────────────────────────────────────────

function safeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'untitled'
}

function formatTimestamp(iso: string): string {
  const date = dayjs(iso)
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : iso
}

/**
 * Resolve document metadata for a conversation.
 * Returns a partial object — only fields that exist on the document.
 */
function buildDocMeta(doc: DocumentEntity | undefined): string[] {
  if (!doc) return []
  const lines: string[] = []
  if (doc.title) lines.push(`> 文档标题: ${doc.title}`)
  if (doc.url) lines.push(`> 文档链接: ${doc.url}`)
  if (doc.author) lines.push(`> 作者: ${doc.author}`)
  if (doc.siteName) lines.push(`> 站点: ${doc.siteName}`)
  if (doc.publishedAt) lines.push(`> 发布时间: ${formatTimestamp(doc.publishedAt)}`)
  if (doc.capturedAt) lines.push(`> 收藏时间: ${formatTimestamp(doc.capturedAt)}`)
  return lines
}

/**
 * Format a single message as Markdown.
 *
 * - User messages: `## 🧑 用户` + content
 * - Assistant messages: `## 🤖 {modelId}` + optional thinking block + content + meta
 * - System messages: `## ⚙️ 系统` + content
 */
export function formatMessageAsMarkdown(msg: ChatMessage): string {
  const ts = msg.createdAt ? formatTimestamp(msg.createdAt) : ''

  if (msg.role === 'user') {
    return [
      `## 🧑 用户`,
      '',
      ts && `*${ts}*`,
      '',
      msg.content || '(空)',
    ].filter(Boolean).join('\n')
  }

  if (msg.role === 'system') {
    return [
      `## ⚙️ 系统`,
      '',
      ts && `*${ts}*`,
      '',
      msg.content || '(空)',
    ].filter(Boolean).join('\n')
  }

  // Assistant
  const headerParts = ['## 🤖 助手']
  if (msg.modelId) headerParts.push(`\`${msg.modelId}\``)
  const lines: string[] = [
    headerParts.join(' '),
    '',
    ts && `*${ts}*`,
  ]

  // Thinking / reasoning content
  if (msg.reasoningContent) {
    lines.push(
      '',
      '<details>',
      '<summary>💭 思考过程</summary>',
      '',
      msg.reasoningContent,
      '',
      '</details>',
    )
  }

  // Main content
  lines.push('', msg.content || '(空)')

  // Meta line (tokens, duration, cost)
  const metaParts: string[] = []
  if (msg.tokenUsage) {
    const total = (msg.tokenUsage.promptTokens ?? 0) + (msg.tokenUsage.completionTokens ?? 0)
    metaParts.push(`Tokens: ${formatTokens(total)}`)
  }
  if (msg.durationMs != null) {
    metaParts.push(`耗时: ${formatMs(msg.durationMs)}`)
  }
  if (msg.status === 'failed') {
    metaParts.push(`❌ 失败: ${msg.error || '未知错误'}`)
  } else if (msg.status === 'aborted') {
    metaParts.push('⏹️ 已停止')
  }
  if (metaParts.length > 0) {
    lines.push('', `> ${metaParts.join(' · ')}`)
  }

  return lines.filter((l) => l !== '').join('\n')
}

/**
 * Format a single message as plain Markdown text (for clipboard copy).
 * This is a simpler version without the full header — just role + content.
 */
export function formatMessageForCopy(msg: ChatMessage): string {
  const roleLabel = msg.role === 'user' ? '🧑 用户' : msg.role === 'assistant' ? '🤖 助手' : '⚙️ 系统'
  const parts: string[] = [`**${roleLabel}**`]

  if (msg.role === 'assistant' && msg.modelId) {
    parts[0] += ` (\`${msg.modelId}\`)`
  }

  parts.push('')

  if (msg.reasoningContent) {
    parts.push('<details>', '<summary>💭 思考过程</summary>', '', msg.reasoningContent, '', '</details>', '')
  }

  parts.push(msg.content || '(空)')

  return parts.join('\n')
}

// ── Single conversation export ─────────────────────────────

export interface ConversationExportOptions {
  /** Include the document metadata header. Default: true */
  includeDocMeta?: boolean
  /** Include thinking/reasoning content. Default: true */
  includeThinking?: boolean
  /** Include token usage & timing meta. Default: true */
  includeMeta?: boolean
}

/**
 * Export a single conversation as a Markdown string.
 */
export function exportConversationAsMarkdown(
  conv: ConversationEntity,
  doc?: DocumentEntity,
  options: ConversationExportOptions = {},
): string {
  const { includeDocMeta = true, includeThinking = true, includeMeta = true } = options

  const lines: string[] = []

  // Title
  lines.push(`# ${conv.title || 'AI 对话'}`)
  lines.push('')

  // Conversation metadata
  lines.push('> 对话信息')
  lines.push(`> 创建时间: ${formatTimestamp(conv.createdAt)}`)
  lines.push(`> 更新时间: ${formatTimestamp(conv.updatedAt)}`)
  lines.push(`> 消息数: ${conv.messages.length}`)
  lines.push('')

  // Document metadata
  if (includeDocMeta && doc) {
    const docMeta = buildDocMeta(doc)
    if (docMeta.length > 0) {
      lines.push('> 关联文档')
      for (const m of docMeta) lines.push(m)
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')

  // Messages
  for (const msg of conv.messages) {
    const msgMd = formatMessageAsMarkdown(
      includeMeta ? msg : { ...msg, tokenUsage: undefined, durationMs: undefined, firstTokenMs: undefined, genMs: undefined },
    )

    // Filter out thinking content if disabled
    if (!includeThinking) {
      const cleaned = msgMd
        .replace(/<details>[\s\S]*?<\/details>\n*/g, '')
        .trim()
      lines.push(cleaned)
    } else {
      lines.push(msgMd)
    }

    lines.push('', '---', '')
  }

  return lines.join('\n')
}

/**
 * Export a single conversation as a JSON string (full fidelity).
 */
export function exportConversationAsJson(
  conv: ConversationEntity,
  doc?: DocumentEntity,
): string {
  const payload = {
    conversation: {
      id: conv.id,
      documentId: conv.documentId,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    },
    document: doc
      ? {
          id: doc.id,
          url: doc.url,
          title: doc.title,
          siteName: doc.siteName,
          author: doc.author,
          description: doc.description,
          publishedAt: doc.publishedAt,
          capturedAt: doc.capturedAt,
          wordCount: doc.wordCount,
          tokenCount: doc.tokenCount,
          extractionMethod: doc.extractionMethod,
          source: doc.source,
        }
      : null,
    messages: conv.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      reasoningContent: m.reasoningContent,
      modelId: m.modelId,
      status: m.status,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      error: m.error,
      tokenUsage: m.tokenUsage,
      durationMs: m.durationMs,
      firstTokenMs: m.firstTokenMs,
      genMs: m.genMs,
    })),
  }

  return JSON.stringify(payload, null, 2)
}

// ── Batch export ───────────────────────────────────────────

export interface BatchExportFilter {
  /** Only export conversations for these document IDs. If empty, all documents. */
  documentIds?: string[]
  /** Only export conversations created after this timestamp (ms epoch). */
  fromMs?: number
  /** Only export conversations created before this timestamp (ms epoch). */
  toMs?: number
}

/**
 * Batch export multiple conversations as a ZIP of Markdown files.
 *
 * Each file is named `{index}-{conversationTitle}.md`.
 * If multiple conversations share the same document, they are grouped under
 * a document-name subfolder.
 */
export function exportConversationsToZip(
  conversations: ConversationEntity[],
  documents: Map<string, DocumentEntity>,
  filter: BatchExportFilter = {},
): Blob {
  // Apply filters
  let filtered = conversations

  if (filter.documentIds?.length) {
    const idSet = new Set(filter.documentIds)
    filtered = filtered.filter((c) => idSet.has(c.documentId))
  }

  if (filter.fromMs != null) {
    filtered = filtered.filter((c) => {
      const t = dayjs(c.createdAt).valueOf()
      return !Number.isNaN(t) && t >= filter.fromMs!
    })
  }

  if (filter.toMs != null) {
    filtered = filtered.filter((c) => {
      const t = dayjs(c.createdAt).valueOf()
      return !Number.isNaN(t) && t <= filter.toMs!
    })
  }

  // Sort by createdAt ascending
  filtered = [...filtered].sort(
    (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
  )

  const files: Record<string, Uint8Array> = {}
  const usedNames = new Set<string>()

  filtered.forEach((conv, i) => {
    const doc = documents.get(conv.documentId)
    const index = String(i + 1).padStart(2, '0')
    const titlePart = safeFilename(conv.title || `对话-${conv.id.slice(0, 8)}`)

    // Group by document title if available
    let name: string
    if (doc?.title) {
      const folder = safeFilename(doc.title).slice(0, 40)
      name = `${folder}/${index}-${titlePart}.md`
    } else {
      name = `${index}-${titlePart}.md`
    }

    // Deduplicate
    if (usedNames.has(name)) {
      let n = 2
      const base = name.replace(/\.md$/, '')
      while (usedNames.has(`${base}-${n}.md`)) n++
      name = `${base}-${n}.md`
    }
    usedNames.add(name)

    const content = exportConversationAsMarkdown(conv, doc)
    files[name] = strToU8(content)
  })

  // Add an index file (only when there are conversations)
  if (filtered.length > 0) {
    const indexLines: string[] = ['# 对话导出索引', '']
    indexLines.push(`> 导出时间: ${formatTimestamp(dayjs().toISOString())}`)
    indexLines.push(`> 对话数量: ${filtered.length}`)
    indexLines.push('')

    filtered.forEach((conv, i) => {
      const doc = documents.get(conv.documentId)
      const num = String(i + 1).padStart(2, '0')
      const docTitle = doc?.title || '未关联文档'
      indexLines.push(`${num}. **${conv.title || '未命名对话'}** — ${docTitle} (${conv.messages.length} 条消息)`)
    })

    files['index.md'] = strToU8(indexLines.join('\n'))
  }

  const zipped = zipSync(files)
  return new Blob([zipped], { type: 'application/zip' })
}

/**
 * Batch export multiple conversations as a single JSON file.
 */
export function exportConversationsAsJson(
  conversations: ConversationEntity[],
  documents: Map<string, DocumentEntity>,
  filter: BatchExportFilter = {},
): string {
  let filtered = conversations

  if (filter.documentIds?.length) {
    const idSet = new Set(filter.documentIds)
    filtered = filtered.filter((c) => idSet.has(c.documentId))
  }

  if (filter.fromMs != null) {
    filtered = filtered.filter((c) => {
      const t = dayjs(c.createdAt).valueOf()
      return !Number.isNaN(t) && t >= filter.fromMs!
    })
  }

  if (filter.toMs != null) {
    filtered = filtered.filter((c) => {
      const t = dayjs(c.createdAt).valueOf()
      return !Number.isNaN(t) && t <= filter.toMs!
    })
  }

  const payload = {
    exportedAt: dayjs().toISOString(),
    count: filtered.length,
    conversations: filtered.map((conv) => {
      const doc = documents.get(conv.documentId)
      return {
        conversation: {
          id: conv.id,
          documentId: conv.documentId,
          title: conv.title,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        },
        document: doc
          ? {
              id: doc.id,
              url: doc.url,
              title: doc.title,
              author: doc.author,
              publishedAt: doc.publishedAt,
              capturedAt: doc.capturedAt,
            }
          : null,
        messages: conv.messages,
      }
    }),
  }

  return JSON.stringify(payload, null, 2)
}

// ── Download helpers ───────────────────────────────────────

/**
 * Copy text to clipboard with a fallback for non-secure contexts.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: textarea + execCommand
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
