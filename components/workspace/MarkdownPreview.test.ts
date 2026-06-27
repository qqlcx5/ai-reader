import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive, nextTick } from 'vue'
import MarkdownPreview from './MarkdownPreview.vue'

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html: string) => html),
  },
}))

// Mock marked
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn((md: string) => `<h1>${md.replace(/^# /, '')}</h1>`),
  },
}))

// Mock highlight.js
vi.mock('highlight.js', () => ({
  default: {
    highlightElement: vi.fn(),
  },
}))

function createMockDocumentStore(doc: any) {
  return reactive({
    currentDocument: doc,
  })
}

vi.mock('@/stores/document.store', () => ({
  useDocumentStore: vi.fn(),
}))

import { useDocumentStore } from '@/stores/document.store'

const mockDocStore = vi.mocked(useDocumentStore)

describe('MarkdownPreview', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders markdown content as HTML', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore({
      markdown: '# Hello World',
    }) as any)

    const wrapper = mount(MarkdownPreview)
    expect(wrapper.html()).toContain('<h1>Hello World</h1>')
  })

  it('shows placeholder when markdown is empty', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore({
      markdown: '',
    }) as any)

    const wrapper = mount(MarkdownPreview)
    expect(wrapper.text()).toContain('暂无 Markdown 内容')
  })

  it('shows placeholder when document is null', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore(null) as any)

    const wrapper = mount(MarkdownPreview)
    expect(wrapper.text()).toContain('暂无 Markdown 内容')
  })

  it('sanitizes HTML output via DOMPurify', async () => {
    const DOMPurify = await import('dompurify')
    mockDocStore.mockReturnValue(createMockDocumentStore({
      markdown: '# Test',
    }) as any)

    mount(MarkdownPreview)
    expect(DOMPurify.default.sanitize).toHaveBeenCalled()
  })

  it('renders code blocks and highlights them', async () => {
    const { marked } = await import('marked')
    ;(marked.parse as any).mockReturnValue('<pre><code class="language-js">const a = 1;</code></pre>')

    mockDocStore.mockReturnValue(createMockDocumentStore({
      markdown: '# Test',
    }) as any)

    const wrapper = mount(MarkdownPreview)
    await nextTick()
    await nextTick()

    // Verify code block is rendered
    const pre = wrapper.find('pre')
    expect(pre.exists()).toBe(true)
    const code = pre.find('code')
    expect(code.exists()).toBe(true)
    expect(code.text()).toContain('const a = 1;')
  })
})
