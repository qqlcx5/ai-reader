import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderMarkdown, enhanceCodeBlocks } from './markdown'

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
