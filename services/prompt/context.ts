import type { ContextSettings } from '../../types/settings'

export interface PageDocument {
  title: string
  url: string
  markdown: string
  wordCount: number
  tokenCount: number
  siteName?: string
  capturedAt?: string
}

export function buildPageContext(
  doc: PageDocument,
  settings?: ContextSettings,
): string {
  // Safe defaults: include everything when settings is not provided
  const includeTitle = settings?.includeTitleInPrompt ?? true
  const includeUrl = settings?.includeUrlInPrompt ?? true
  const includeCapturedAt = settings?.includeCapturedAtInPrompt ?? false
  const includeMetadata = settings?.includeMetadataInPrompt ?? true

  const lines: string[] = []

  if (includeMetadata) {
    if (includeTitle) {
      lines.push(`- Title: ${doc.title}`)
    }

    if (includeUrl) {
      lines.push(`- URL: ${doc.url}`)
    }

    if (doc.siteName) {
      lines.push(`- Site: ${doc.siteName}`)
    }

    if (includeCapturedAt && doc.capturedAt) {
      lines.push(`- Captured: ${doc.capturedAt}`)
    }
  }

  lines.push(doc.markdown)

  return lines.join('\n')
}
