import { marked, type MarkedOptions, type Tokens } from 'marked'
import DOMPurify, { type Config } from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const BLOCK_LANGUAGES = new Set([
  'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'css', 'html', 'xml',
  'json', 'bash', 'sh', 'shell',
])

function safeLang(lang?: string): string {
  return lang && BLOCK_LANGUAGES.has(lang.toLowerCase()) ? lang.toLowerCase() : 'plaintext'
}

function highlightCode(code: string, lang: string): string {
  const language = safeLang(lang)
  if (language === 'plaintext') {
    return code
  }
  try {
    const result = hljs.highlight(code, { language })
    return result.value
  } catch {
    return code
  }
}

const markedOptions: MarkedOptions = {
  gfm: true,
  breaks: false,
}

function customCode(token: Tokens.Code): string {
  const language = safeLang(token.lang || undefined)
  const highlighted = highlightCode(token.text, language)
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
}

function sanitizeConfig() {
  return {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'span', 'div',
      'strong', 'b', 'em', 'i', 'u', 's', 'del', 'a', 'img',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'table', 'thead', 'tbody',
      'tr', 'th', 'td', 'sup', 'sub', 'mark', 'small', 'dl', 'dt', 'dd',
      'input', 'label',
    ],
    ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'class', 'id', 'target', 'rel', 'type', 'checked', 'disabled'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|data):|#|\/\/)[^\s]*$/i,
    KEEP_CONTENT: true as unknown as boolean,
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
  } as Config
}

export function renderMarkdown(md: string): string {
  const rawHtml = marked.parse(md, markedOptions) as string
  const codeWrapped = rawHtml.replace(
    /<pre><code class="language-([^"]*)">([\s\S]*?)<\/code><\/pre>/g,
    (_match, lang, code) => customCode({ type: 'code', text: code, lang, escaped: false } as Tokens.Code)
  )
  const cleanHtml = DOMPurify.sanitize(codeWrapped, sanitizeConfig())
  return addLinkSecurity(cleanHtml)
}

function addLinkSecurity(html: string): string {
  // 用 DOM 解析，确保所有 a 标签都带 target 和 rel
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const links = doc.querySelectorAll('a[href]')
  links.forEach((a) => {
    const el = a as HTMLAnchorElement
    const href = el.getAttribute('href') ?? ''
    if (/^(https?:|\/\/|data:)/i.test(href) || href.startsWith('#')) {
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer')
    } else {
      el.removeAttribute('href')
    }
  })
  return doc.body.innerHTML
}

export function renderMarkdownPlain(md: string): string {
  const plain = DOMPurify.sanitize(renderMarkdown(md), { ...sanitizeConfig(), ALLOWED_TAGS: [] as unknown as string[] })
  return plain.replace(/\s+/g, ' ').trim()
}
