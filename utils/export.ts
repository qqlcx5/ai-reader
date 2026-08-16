import { zipSync, strToU8 } from 'fflate'
import type { DocumentEntity } from '@/types/document'

/**
 * Convert a string to a safe filename component.
 * Removes path separators and other unsafe characters.
 */
function safeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'untitled'
}

/**
 * Export an array of documents as a ZIP file containing individual Markdown files.
 * Each file is named `{index}-{title}.md` to avoid collisions and preserve order.
 * Returns a Blob ready for download.
 */
export function exportDocumentsToZip(documents: DocumentEntity[]): Blob {
  const files: Record<string, Uint8Array> = {}

  const usedNames = new Set<string>()
  documents.forEach((doc, i) => {
    const prefix = String(i + 1).padStart(2, '0')
    const base = `${prefix}-${safeFilename(doc.title || 'untitled')}`
    let name = `${base}.md`
    // Deduplicate: if the same name was already used, append a suffix.
    if (usedNames.has(name)) {
      let n = 2
      while (usedNames.has(`${base}-${n}.md`)) n++
      name = `${base}-${n}.md`
    }
    usedNames.add(name)

    const meta = [
      '---',
      `title: "${(doc.title || 'Untitled').replace(/"/g, '\"')}"`,
      `source: ${doc.url}`,
      doc.author ? `author: ${doc.author}` : null,
      doc.publishedAt ? `published: ${doc.publishedAt}` : null,
      `captured: ${doc.capturedAt}`,
      doc.tags?.length ? `tags: [${doc.tags.join(', ')}]` : null,
      '---',
      '',
      `# ${doc.title || 'Untitled'}`,
      '',
      '---',
      '',
    ]
      .filter((l) => l !== null)
      .join('\n')

    let content = meta + (doc.markdown || '')

    // Highlights as an Obsidian-friendly section (==mark== syntax + notes).
    const highlights = (doc.highlights ?? []).slice().sort((a, b) => a.startOffset - b.startOffset)
    if (highlights.length > 0) {
      const lines = highlights.map((h) => {
        const base = `- ==${h.text.replaceAll('\n', ' ')}==`
        return h.note?.trim() ? `${base}\n  - 笔记：${h.note.trim().replaceAll('\n', ' ')}` : base
      })
      content += `\n\n## 高亮\n\n${lines.join('\n')}\n`
    }

    files[name] = strToU8(content)
  })

  const zipped = zipSync(files)
  return new Blob([zipped], { type: 'application/zip' })
}

/**
 * Trigger a browser download for a Blob with the given filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
