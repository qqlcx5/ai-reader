/**
 * Inline citation rendering for knowledge-QA answers.
 *
 * Turns `[1]`-style markers in the STREAMED markdown into clickable
 * superscript chips once sources are attached to the message. Text-only walk
 * (never touches attributes or code), applied after the HTML is in the DOM —
 * same pattern as enhanceCodeBlocks.
 */

const CITE_RE = /\[(\d{1,2})\]/g

export function enhanceCitations(container: HTMLElement, sources: Array<{ id: string }>): void {
  if (sources.length === 0) return

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE' || parent.closest('pre, code, a, .citation')) {
        return NodeFilter.FILTER_REJECT
      }
      return CITE_RE.test(node.textContent || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })

  const targets: Text[] = []
  let current = walker.nextNode()
  while (current) {
    targets.push(current as Text)
    current = walker.nextNode()
  }

  for (const textNode of targets) {
    const text = textNode.textContent || ''
    const frag = document.createDocumentFragment()
    let last = 0
    CITE_RE.lastIndex = 0
    for (const match of text.matchAll(CITE_RE)) {
      const n = Number(match[1])
      if (n < 1 || n > sources.length) continue
      const start = match.index ?? 0
      if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)))
      const sup = document.createElement('sup')
      sup.className = 'citation'
      sup.dataset.docId = sources[n - 1].id
      sup.textContent = `[${n}]`
      frag.appendChild(sup)
      last = start + match[0].length
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
    textNode.replaceWith(frag)
  }
}
