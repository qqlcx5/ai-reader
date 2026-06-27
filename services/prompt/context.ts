export interface PageDocument {
  title: string
  url: string
  markdown: string
  wordCount: number
  tokenCount: number
  siteName?: string
  capturedAt?: string
}

export function buildPageContext(doc: PageDocument): string {
  const lines: string[] = ['## Page Context']

  lines.push(`- Title: ${doc.title}`)
  lines.push(`- URL: ${doc.url}`)

  if (doc.siteName) {
    lines.push(`- Site: ${doc.siteName}`)
  }

  if (doc.capturedAt) {
    lines.push(`- Captured: ${doc.capturedAt}`)
  }

  lines.push('', '### Content', doc.markdown)

  return lines.join('\n')
}
