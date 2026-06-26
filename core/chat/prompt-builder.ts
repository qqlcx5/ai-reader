/**
 * Prompt builder for Chat with Doc.
 *
 * Assembles the message array that gets sent to the chat adapter
 * (see `core/models/openai-compat.adapter.ts`).
 *
 * The layout is intentionally simple and explicit so it is easy
 * to inspect / diff in the UI:
 *
 *   1. `system`    – resolved system prompt (model > global > builtin)
 *   2. `user`      – "document context" block (metadata + markdown)
 *                    This is a single message so the model gets one
 *                    well-defined prefix to read first.
 *   3. history…    – previous turns in chronological order, rewritten
 *                    as `user` / `assistant` messages.
 *   4. `user`      – the current question.
 *
 * The document markdown is truncated to roughly `MAX_DOC_TOKENS`
 * (estimated) so we never blow past the model's context window.
 * Truncation prefers the start of the article — head usually
 * carries the abstract / key claims.
 *
 * The system prompt and the document context block both support
 * `{{date}}`, `{{datetime}}`, `{{url}}`, `{{title}}`, `{{language}}`
 * template variables (filled in with `dayjs`). The system prompt
 * is the most likely place the user customises these, so we
 * substitute them there even though the document context is
 * structured (we only substitute inside the system prompt to
 * keep the rest of the message byte-stable for caching).
 */

import dayjs from 'dayjs'
import type { CapturedDocument, ChatHistoryMessage, ChatMessage as ModelChatMessage } from '@db/schema'

/** Default cap for the document content slice (in estimated tokens). */
export const MAX_DOC_TOKENS = 8_000

/**
 * Conservative average characters-per-token for English / Chinese
 * mixed content. 4 chars/token is the usual ballpark for English,
 * and 1.5–2 for CJK; the midpoint is safe.
 */
const CHARS_PER_TOKEN = 3

/** Upper bound for the markdown body in characters. */
export const MAX_DOC_CHARS = MAX_DOC_TOKENS * CHARS_PER_TOKEN

/**
 * Replace the supported template variables in a string.
 *
 * Supported: `{{date}}`, `{{datetime}}`, `{{url}}`, `{{title}}`,
 * `{{language}}`. Unknown placeholders are left untouched so the
 * user can see their typo.
 */
export function applyTemplateVariables(
  template: string,
  ctx: { document: CapturedDocument; now?: number }
): string {
  const now = ctx.now ?? Date.now()
  return template
    .replace(/\{\{\s*date\s*\}\}/gi, dayjs(now).format('YYYY-MM-DD'))
    .replace(/\{\{\s*datetime\s*\}\}/gi, dayjs(now).format('YYYY-MM-DD HH:mm:ss'))
    .replace(/\{\{\s*url\s*\}\}/gi, ctx.document.url ?? '')
    .replace(/\{\{\s*title\s*\}\}/gi, ctx.document.title ?? '')
    .replace(/\{\{\s*language\s*\}\}/gi, ctx.document.language ?? ctx.document.siteName ?? '')
}

/**
 * Build the document-context user message.
 *
 * Returns a single string that combines the document metadata
 * (title, URL, publishedAt, siteName, wordCount) with the markdown
 * body. The body is truncated to `MAX_DOC_CHARS` characters.
 */
export function buildDocumentContext(document: CapturedDocument): string {
  const metaLines: string[] = ['# Document context']
  metaLines.push('')
  metaLines.push(`- Title: ${document.title || '(untitled)'}`)
  metaLines.push(`- URL: ${document.url}`)
  if (document.siteName) metaLines.push(`- Site: ${document.siteName}`)
  if (document.publishedAt) metaLines.push(`- Published: ${document.publishedAt}`)
  if (document.author) metaLines.push(`- Author: ${document.author}`)
  if (document.language) metaLines.push(`- Language: ${document.language}`)
  if (typeof document.wordCount === 'number') {
    metaLines.push(`- Word count: ${document.wordCount}`)
  }

  metaLines.push('')
  metaLines.push('## Content')
  metaLines.push('')

  const body = document.markdownContent || document.content || ''
  const truncated = truncateDocumentBody(body, MAX_DOC_CHARS)

  metaLines.push(truncated)
  return metaLines.join('\n')
}

/**
 * Truncate a (possibly very long) document body. Prefer keeping
 * the start of the article — that is where the abstract / lede
 * lives. Append a notice so the model knows content was cut.
 */
export function truncateDocumentBody(body: string, maxChars: number): string {
  if (body.length <= maxChars) return body
  const cut = body.slice(0, maxChars)
  return `${cut}\n\n…[truncated; original ${body.length} chars]`
}

/**
 * Convert a `ChatHistoryMessage` into the adapter-level `Message`.
 *
 * The runtime protocol and the persisted history have nearly
 * identical shapes (`role` + `content`); this function is mostly
 * a guard against future drift.
 */
function historyToModelMessage(m: ChatHistoryMessage): ModelChatMessage {
  return {
    role: m.role === 'system' ? 'system' : m.role,
    content: m.content,
  }
}

/**
 * Build the full `ChatMessage[]` array for the chat adapter.
 *
 * - Substitutes template variables in the system prompt.
 * - Inserts a single document-context message before the history
 *   and the current question.
 * - Filters out empty messages (defensive — empty assistant
 *   placeholders can exist while the model is still streaming).
 */
export function buildMessages(
  document: CapturedDocument,
  question: string,
  history: ChatHistoryMessage[],
  systemPrompt: string
): ModelChatMessage[] {
  const messages: ModelChatMessage[] = []

  const filledSystem = systemPrompt
    ? applyTemplateVariables(systemPrompt, { document })
    : ''
  if (filledSystem.trim()) {
    messages.push({ role: 'system', content: filledSystem })
  }

  // Single, structured document context message.
  const contextMessage = buildDocumentContext(document)
  messages.push({ role: 'user', content: contextMessage })

  // Replay history. Drop empties.
  for (const h of history) {
    if (!h.content || !h.content.trim()) continue
    messages.push(historyToModelMessage(h))
  }

  // Current question.
  if (question && question.trim()) {
    messages.push({ role: 'user', content: question })
  }

  return messages
}
