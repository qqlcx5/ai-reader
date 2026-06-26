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
 * Parse YAML frontmatter into key-value pairs.
 * Returns null if no valid frontmatter found.
 */
export function parseFrontmatter(markdown: string): Record<string, string> | null {
  const trimmed = markdown.trimStart()
  if (!trimmed.startsWith('---')) return null

  const firstNewline = trimmed.indexOf('\n')
  if (firstNewline === -1) return null

  const closingIdx = trimmed.indexOf('\n---', firstNewline + 1)
  if (closingIdx === -1) return null

  const yaml = trimmed.slice(firstNewline + 1, closingIdx)
  const result: Record<string, string> = {}

  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let value = line.slice(colonIdx + 1).trim()
    // Unquote
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && value) result[key] = value
  }

  return Object.keys(result).length > 0 ? result : null
}

/**
 * Build an HTML metadata card from parsed frontmatter.
 * Returns empty string if frontmatter is null.
 */
export function renderFrontmatterCard(fm: Record<string, string> | null): string {
  if (!fm) return ''

  const labelMap: Record<string, string> = {
    title: '标题',
    url: '来源',
    author: '作者',
    site_name: '站点',
    published_at: '发布时间',
    extracted_at: '提取时间',
  }

  const rows = Object.entries(fm)
    .filter(([k]) => k in labelMap)
    .map(([k, v]) => {
      const label = labelMap[k] || k
      const display = k === 'url'
        ? `<a href="${v}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:none">${v}</a>`
        : k === 'extracted_at' || k === 'published_at'
          ? formatFrontmatterDate(v)
          : v
      return `<div style="display:flex;align-items:baseline;gap:8px;padding:4px 0"><span style="flex-shrink:0;font-size:11px;color:#86868b;min-width:60px">${label}</span><span style="font-size:13px;color:#1d1d1f;word-break:break-all">${display}</span></div>`
    })
    .join('')

  return `<div style="margin-bottom:18px;padding:14px 16px;border-radius:14px;background:rgba(250,250,250,0.8);border:1px solid rgba(0,0,0,0.06);font-family:system-ui,-apple-system,sans-serif">${rows}</div>`
}

function formatFrontmatterDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
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
