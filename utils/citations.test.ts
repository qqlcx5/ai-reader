import { describe, it, expect, beforeEach } from 'vitest'
import { enhanceCitations } from './citations'

function setup(html: string): HTMLElement {
  document.body.innerHTML = `<div id="c">${html}</div>`
  return document.getElementById('c')!
}

const SOURCES = [{ id: 'doc-a' }, { id: 'doc-b' }]

describe('enhanceCitations', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('turns [n] markers into clickable sup chips with doc ids', () => {
    const container = setup('<p>结论一 [1] 与结论二 [2]。</p>')
    enhanceCitations(container, SOURCES)
    const chips = container.querySelectorAll('sup.citation')
    expect(chips).toHaveLength(2)
    expect((chips[0] as HTMLElement).dataset.docId).toBe('doc-a')
    expect((chips[1] as HTMLElement).dataset.docId).toBe('doc-b')
    expect(container.textContent).toContain('结论一')
    expect(container.textContent).toContain('[1]')
  })

  it('ignores out-of-range markers and skips code/links', () => {
    const container = setup('<p>只有 [3] 超界</p><pre><code>代码 [1]</code></pre><a href="#">链 [1]</a>')
    enhanceCitations(container, SOURCES)
    expect(container.querySelectorAll('sup.citation')).toHaveLength(0)
    expect(container.querySelector('code')!.textContent).toContain('[1]')
  })

  it('is a no-op without sources', () => {
    const container = setup('<p>[1]</p>')
    enhanceCitations(container, [])
    expect(container.querySelectorAll('sup.citation')).toHaveLength(0)
  })
})
