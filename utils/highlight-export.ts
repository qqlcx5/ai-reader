import type { DocumentEntity } from '@/types/document'

/**
 * Export a document's highlights as a standalone Markdown note:
 * title + source link + each highlight as a quote with optional note.
 */
export function highlightsToMarkdown(doc: DocumentEntity): string {
  const highlights = (doc.highlights ?? []).slice().sort((a, b) => a.startOffset - b.startOffset)
  if (highlights.length === 0) return ''

  const lines: string[] = [`# ${doc.title || '无标题'} · 高亮`, '']
  if (doc.url) lines.push(`> 来源：[${doc.url}](${doc.url})`, '')
  lines.push(`> 共 ${highlights.length} 条高亮 · ${doc.capturedAt.slice(0, 10)} 剪藏`, '', '---', '')

  for (const h of highlights) {
    lines.push(h.text.replaceAll('\n', ' '), '')
    if (h.note?.trim()) lines.push(`**笔记**：${h.note.trim().replaceAll('\n', ' ')}`, '')
  }
  return lines.join('\n')
}
