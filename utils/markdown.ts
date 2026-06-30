import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import markedFootnote from 'marked-footnote'
import { gfmHeadingId } from 'marked-gfm-heading-id'

// Single shared markdown pipeline for MarkdownPreview, ChatMessage, and future
// reader views. Everything renders through here so styling + sanitization +
// code-block UX stay consistent. Register extra features in one place via
// marked.use(...) — every consumer then gets them. GFM tables / strikethrough /
// task-list checkboxes are on by default; footnotes + heading anchors are
// registered below.

const SANITIZE_OPTS = {
  ADD_TAGS: ['img'],
  ADD_ATTR: ['src', 'alt', 'title', 'width', 'height', 'loading', 'srcset', 'sizes', 'id', 'controls'],
}

/** Sanitize raw HTML (e.g. RSS feed bodies) with the same policy as markdown. */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, SANITIZE_OPTS)
}

let configured = false
function configure(): void {
  if (configured) return
  configured = true
  // Guard: some tests mock `marked` without a `.use`. Real marked has it.
  if (typeof marked.use === 'function') {
    marked.use(markedFootnote(), gfmHeadingId())
  }
}

export function renderMarkdown(md: string): string {
  if (!md) return ''
  configure()
  const raw = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(raw, SANITIZE_OPTS)
}

function langOf(code: Element): string {
  const m = /language-([\w+-]+)/.exec(code.className || '')
  return m ? m[1] : ''
}

/**
 * Highlight `<pre><code>` blocks and wrap each in a header with a language
 * label + copy button. Idempotent (marks blocks via data attribute). Must run
 * after the rendered HTML is in the DOM (e.g. in a `watch` + `nextTick`).
 */
export function enhanceCodeBlocks(container: HTMLElement): void {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>('pre code'))
  for (const code of blocks) {
    if (code.dataset.amEnhanced) continue
    code.dataset.amEnhanced = '1'

    let lang = langOf(code)
    try {
      if (!lang && typeof hljs.highlightAuto === 'function') {
        lang = hljs.highlightAuto(code.textContent || '').language || ''
      }
      if (typeof hljs.highlightElement === 'function') {
        hljs.highlightElement(code)
      }
    } catch {
      // leave block unhighlighted
    }

    const pre = code.parentElement
    if (!pre || pre.parentElement?.classList.contains('code-block')) continue

    const wrap = document.createElement('div')
    wrap.className = 'code-block'

    const header = document.createElement('div')
    header.className = 'code-block__header'

    const label = document.createElement('span')
    label.className = 'code-block__lang'
    label.textContent = lang || 'text'

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'code-block__copy'
    btn.textContent = '复制'
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent || '')
        btn.textContent = '已复制'
        setTimeout(() => {
          btn.textContent = '复制'
        }, 1500)
      } catch {
        // clipboard blocked — ignore
      }
    })

    header.appendChild(label)
    header.appendChild(btn)
    pre.parentNode!.insertBefore(wrap, pre)
    wrap.appendChild(header)
    wrap.appendChild(pre)
  }
}
