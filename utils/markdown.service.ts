// ============================================================
// PageMind — Markdown Service (Frontmatter + Metadata)
// ============================================================

import type { ExtractResult } from '@/domain'

export interface FrontmatterMeta {
  title: string
  url?: string
  author?: string
  siteName?: string
  publishedAt?: string
  extractedAt: string
}

/**
 * Build frontmatter YAML block from extraction result metadata.
 */
export function buildFrontmatter(meta: FrontmatterMeta): string {
  const lines: string[] = ['---']
  lines.push(`title: "${meta.title.replace(/"/g, '\\"')}"`)
  if (meta.url) lines.push(`url: "${meta.url}"`)
  if (meta.author) lines.push(`author: "${meta.author}"`)
  if (meta.siteName) lines.push(`site_name: "${meta.siteName}"`)
  if (meta.publishedAt) lines.push(`published_at: "${meta.publishedAt}"`)
  lines.push(`extracted_at: "${meta.extractedAt}"`)
  lines.push('---')
  lines.push('')
  return lines.join('\n')
}

/**
 * Conditionally prepend frontmatter to markdown based on includeFrontmatter setting.
 * Also strips any existing frontmatter before applying to avoid duplication.
 */
export function applyFrontmatter(
  markdown: string,
  meta: FrontmatterMeta,
  includeFrontmatter: boolean,
): string {
  // Strip existing frontmatter (if any) to avoid duplication
  const stripped = stripFrontmatter(markdown)

  if (!includeFrontmatter) return stripped

  return buildFrontmatter(meta) + stripped
}

/**
 * Remove YAML frontmatter block from markdown text.
 * Frontmatter is delimited by --- at the very start and end.
 */
export function stripFrontmatter(markdown: string): string {
  const trimmed = markdown.trimStart()
  if (!trimmed.startsWith('---')) return markdown

  const firstNewline = trimmed.indexOf('\n')
  if (firstNewline === -1) return markdown

  const closingIdx = trimmed.indexOf('\n---', firstNewline + 1)
  if (closingIdx === -1) return markdown // no closing delimiter, not valid frontmatter

  // Return content after closing --- + newline
  const afterClosing = trimmed.indexOf('\n', closingIdx + 4)
  if (afterClosing === -1) return ''

  return trimmed.slice(afterClosing + 1)
}

/**
 * Build FrontmatterMeta from ExtractResult + defaults.
 */
export function makeFrontmatterMeta(
  result: ExtractResult,
  fallbackTitle: string,
): FrontmatterMeta {
  return {
    title: result.title || fallbackTitle || 'Untitled',
    url: result.url,
    author: result.author,
    siteName: result.siteName,
    publishedAt: result.publishedAt,
    extractedAt: new Date().toISOString(),
  }
}
