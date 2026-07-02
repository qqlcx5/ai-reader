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
      `# ${doc.title || 'Untitled'}`,
      '',
      `> Source: ${doc.url}`,
      doc.author ? `> Author: ${doc.author}` : null,
      doc.publishedAt ? `> Published: ${doc.publishedAt}` : null,
      `> Captured: ${doc.capturedAt}`,
      '',
      '---',
      '',
    ]
      .filter((l) => l !== null)
      .join('\n')

    const content = meta + (doc.markdown || '')
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
