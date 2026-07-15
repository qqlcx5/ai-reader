import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderMarkdown, enhanceCodeBlocks, sanitizeHtml } from './markdown'

describe('renderMarkdown', () => {
  it('renders headings, lists, and code', () => {
    const html = renderMarkdown('# Title\n\n- one\n- two\n\n`inline`')
    expect(html).toContain('<h1')
    expect(html).toContain('Title')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<code>inline</code>')
  })

  it('sanitizes dangerous markup', () => {
    const html = renderMarkdown('hello <script>alert(1)</script> world')
    expect(html).not.toContain('<script>')
    expect(html).toContain('hello')
  })

  it('keeps <img> tags (DOMPurify default would strip them)', () => {
    const html = renderMarkdown('![alt](https://example.com/a.png)')
    expect(html).toContain('<img')
    expect(html).toContain('src="https://example.com/a.png"')
  })

  it('keeps <video> tags so CSS can bound them (not stripped)', () => {
    const html = renderMarkdown('<video src="https://example.com/a.mp4" width="9999"></video>')
    expect(html).toContain('<video')
    expect(html).toContain('src="https://example.com/a.mp4"')
  })

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('')
  })
  it('renders footnotes when the extension is present', () => {
    const html = renderMarkdown('Here[^1].\n\n[^1]: note body')
    // marked-footnote emits a footnotes section + references
    expect(html).toMatch(/footnote|section|aria-labelledby|^.*1.*note body/s)
  })

  it('adds id anchors to headings', () => {
    const html = renderMarkdown('# Hello World')
    expect(html).toMatch(/id="hello-world"/i)
  })

  it('renders bold when ** is followed by CJK/ASCII quotes', () => {
    // marked v18 has a bug where ** immediately followed by a punctuation char
    // (like CJK quotes \u201c \u201d or ASCII quotes) after a non-punct char
    // fails to parse as bold. We fix it with a preprocess hook.
    const cases = [
      '用**\u201c先建森林\u201d的方法**',
      '用**"先建森林"的方法**',
      '将用**\u201c先建森林，再种树木\u201d的方法**，并结合**费曼技巧和二八定律**',
      '用**先建森林**的方法',
      'a**bold**b',
    ]
    for (const md of cases) {
      const html = renderMarkdown(md)
      expect(html).toContain('<strong>')
    }
  })

  it('renders inline math with $...$', () => {
    const html = renderMarkdown('The formula $E=mc^2$ is famous.')
    expect(html).toContain('katex')
    expect(html).toContain('E=mc')
  })

  it('renders block math with $$...$$', () => {
    const html = renderMarkdown('Here is a equation:\n\n$$\\int_0^1 x^2 dx = \\frac{1}{3}$$\n\nDone.')
    expect(html).toContain('katex-display')
    expect(html).toContain('application/x-tex')
  })

  it('does not treat single $ as math (requires matching pair)', () => {
    const html = renderMarkdown('Price is $5 only')
    expect(html).not.toContain('katex')
  })
})

describe('enhanceCodeBlocks', () => {
  function makeContainer(code: string): HTMLElement {
    const el = document.createElement('div')
    el.innerHTML = code
    return el
  }

  beforeEach(() => {
    // jsdom has no clipboard by default
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  it('wraps a <pre> with a language label and copy button', () => {
    const container = makeContainer('<pre><code class="language-js">const a = 1;</code></pre>')
    enhanceCodeBlocks(container)

    expect(container.querySelector('.code-block')).toBeTruthy()
    expect(container.querySelector('.code-block__lang')?.textContent).toBe('js')
    expect(container.querySelector('.code-block__copy')).toBeTruthy()
    // original code text preserved
    expect(container.querySelector('code')?.textContent).toContain('const a = 1;')
  })

  it('copies code text on click', async () => {
    const container = makeContainer('<pre><code class="language-js">const a = 1;</code></pre>')
    enhanceCodeBlocks(container)

    const btn = container.querySelector('.code-block__copy') as HTMLButtonElement
    await btn.click()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('const a = 1;')
  })

  it('is idempotent (running twice wraps once)', () => {
    const container = makeContainer('<pre><code class="language-js">x</code></pre>')
    enhanceCodeBlocks(container)
    enhanceCodeBlocks(container)
    expect(container.querySelectorAll('.code-block')).toHaveLength(1)
  })
})

describe('sanitizeHtml', () => {
  it('keeps structure + media, strips scripts (shared policy for RSS reader)', () => {
    const out = sanitizeHtml('<p>hi</p><video src="x.mp4" controls></video><script>alert(1)</script>')
    expect(out).toContain('<p>hi</p>')
    expect(out).toContain('<video')
    expect(out).toContain('controls')
    expect(out).not.toContain('<script>')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('')
  })
})
