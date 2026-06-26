import { describe, it, expect, vi } from 'vitest'
import { renderMarkdown, renderMarkdownPlain } from './markdown-renderer'

describe('markdown-renderer', () => {
  it('renders headings, lists, and paragraphs', () => {
    const md = `# Title\n\nSome paragraph.\n\n- item 1\n- item 2`
    const html = renderMarkdown(md)
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<p>Some paragraph.</p>')
    expect(html).toContain('<li>item 1</li>')
    expect(html).toContain('<li>item 2</li>')
  })

  it('renders GFM tables', () => {
    const md = `| a | b |\n|---|---|\n| 1 | 2 |`
    const html = renderMarkdown(md)
    expect(html).toContain('<table>')
    expect(html).toContain('<th>a</th>')
    expect(html).toContain('<td>1</td>')
  })

  it('renders fenced code blocks and highlights', () => {
    const md = `\`\`\`js\nconst x = 1;\n\`\`\``
    const html = renderMarkdown(md)
    expect(html).toContain('<pre><code class="hljs language-js"')
    expect(html).toContain('<span class="hljs-keyword">const</span> x = <span class="hljs-number">1</span>')
  })

  it('renders links with target and rel', () => {
    const md = `[OpenAI](https://openai.com)`
    const html = renderMarkdown(md)
    expect(html).toContain('href="https://openai.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('renders images with allowed protocols', () => {
    const md = `![alt](https://example.com/img.png)`
    const html = renderMarkdown(md)
    expect(html).toContain('<img')
    expect(html).toContain('src="https://example.com/img.png"')
  })

  it('strips dangerous script tags', () => {
    const md = `<script>alert(1)</script>`
    const html = renderMarkdown(md)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert(1)')
  })

  it('strips event handlers', () => {
    const md = `<img src="x" onerror="alert(1)">`
    const html = renderMarkdown(md)
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('alert(1)')
  })

  it('removes javascript: links', () => {
    const md = `[click](javascript:alert(1))`
    const html = renderMarkdown(md)
    expect(html).not.toContain('javascript')
  })

  it('removes file: image links', () => {
    const md = `![img](file:///etc/passwd)`
    const html = renderMarkdown(md)
    expect(html).not.toContain('file:///etc/passwd')
  })

  it('renders task lists', () => {
    const md = `- [x] done\n- [ ] todo`
    const html = renderMarkdown(md)
    expect(html).toContain('<input')
    expect(html).toContain('checked')
  })

  it('renderMarkdownPlain strips all HTML tags', () => {
    const md = `# Title\n\n<script>alert(1)</script>hello`
    const plain = renderMarkdownPlain(md)
    expect(plain).not.toContain('<h1>')
    expect(plain).not.toContain('<script>')
    expect(plain).toContain('Title')
    expect(plain).toContain('hello')
  })
})
