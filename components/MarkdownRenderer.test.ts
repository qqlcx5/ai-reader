/**
 * MarkdownRenderer component tests.
 *
 * Covers the three contracts we promise in the spec:
 *  - basic markdown rendering (headings, lists, code, links)
 *  - XSS sanitisation (inline <script>, javascript: URLs)
 *  - code-block syntax highlighting (class=language-* survives
 *    DOMPurify because we explicitly allow it)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

function render(source: string) {
  return mount(MarkdownRenderer, { props: { source } })
}

describe('MarkdownRenderer', () => {
  it('renders headings, paragraphs, and emphasis', async () => {
    const wrapper = render('# Title\n\nSome **bold** text.')
    await nextTick()
    const html = wrapper.html()
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<p>')
  })

  it('renders unordered lists with bullet markers', async () => {
    const wrapper = render('- one\n- two\n- three')
    await nextTick()
    const html = wrapper.html()
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<li>two</li>')
  })

  it('renders ordered lists', async () => {
    const wrapper = render('1. a\n2. b\n3. c')
    await nextTick()
    const html = wrapper.html()
    expect(html).toContain('<ol>')
    expect(html).toContain('<li>a</li>')
  })

  it('renders GFM-style tables', async () => {
    const wrapper = render(
      '| col1 | col2 |\n|------|------|\n| a    | b    |\n| c    | d    |'
    )
    await nextTick()
    const html = wrapper.html()
    expect(html).toContain('<table>')
    expect(html).toContain('<th>col1</th>')
    expect(html).toContain('<td>a</td>')
  })

  it('renders blockquotes', async () => {
    const wrapper = render('> quoted text')
    await nextTick()
    expect(wrapper.html()).toContain('<blockquote>')
    expect(wrapper.html()).toContain('quoted text')
  })

  it('opens links in a new tab with safe rel attributes', async () => {
    const wrapper = render('[example](https://example.com)')
    await nextTick()
    const html = wrapper.html()
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('escapes inline <script> tags (markdown-it html:false)', async () => {
    // markdown-it is configured with `html: false`, so any inline
    // HTML in the source is escaped to text. The text content of
    // the script is still visible (escaped) but no real <script>
    // node ever enters the DOM.
    const wrapper = render('hello <script>alert(1)</script> world')
    await nextTick()
    const html = wrapper.html()
    expect(html).not.toContain('<script')
    // The raw text is preserved as escaped text.
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('alert(1)')
    // Surrounding text is present.
    expect(html).toContain('hello')
    expect(html).toContain('world')
  })

  it('escapes inline event handlers', async () => {
    const wrapper = render('<img src="x" onerror="alert(1)">')
    await nextTick()
    const html = wrapper.html()
    // With html:false, the <img> is escaped, so no live element
    // can ever fire the onerror.
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img')
  })

  it('strips javascript: URLs in link hrefs', async () => {
    // markdown-it can still produce a link for [x](javascript:...) —
    // we rely on DOMPurify to strip the dangerous scheme.
    const wrapper = render('[click](javascript:alert(1))')
    await nextTick()
    const html = wrapper.html()
    // DOMPurify should strip the dangerous scheme.
    expect(html).not.toMatch(/href="javascript:/i)
  })

  it('syntax-highlights fenced code blocks (javascript)', async () => {
    const wrapper = render('```js\nconst x = 1\n```')
    await nextTick()
    const html = wrapper.html()
    expect(html).toContain('<pre')
    expect(html).toContain('hljs')
    // highlight.js emits span tags with hljs-keyword etc.
    expect(html).toMatch(/class="hljs-[^"]*"/)
  })

  it('escapes the content of an unknown fenced code block', async () => {
    const wrapper = render('```\n<script>alert(1)</script>\n```')
    await nextTick()
    const html = wrapper.html()
    // The code block must not execute the script.
    expect(html).not.toContain('<script>alert(1)</script>')
    // The literal text is still visible.
    expect(html).toContain('&lt;script&gt;')
  })

  it('reacts to prop changes (streaming update)', async () => {
    const wrapper = render('hello')
    await nextTick()
    expect(wrapper.html()).toContain('hello')
    await wrapper.setProps({ source: 'world' })
    await nextTick()
    expect(wrapper.html()).toContain('world')
    expect(wrapper.html()).not.toContain('hello')
  })
})
