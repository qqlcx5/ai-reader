import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import RawPreview from './RawPreview.vue'

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

describe('RawPreview', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders rawText when available', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore({
      rawText: 'Some raw text content',
      markdown: '# Markdown here',
    }) as any)

    const wrapper = mount(RawPreview)
    expect(wrapper.text()).toContain('Some raw text content')
  })

  it('falls back to markdown when rawText is empty', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore({
      rawText: '',
      markdown: '# Fallback markdown',
    }) as any)

    const wrapper = mount(RawPreview)
    expect(wrapper.text()).toContain('# Fallback markdown')
  })

  it('falls back to markdown when rawText is absent', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore({
      markdown: '# Only markdown',
    }) as any)

    const wrapper = mount(RawPreview)
    expect(wrapper.text()).toContain('# Only markdown')
  })

  it('shows placeholder when no content available', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore(null) as any)

    const wrapper = mount(RawPreview)
    expect(wrapper.text()).toContain('暂无原始内容')
  })

  it('renders with dark background styling', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore({
      rawText: 'test',
    }) as any)

    const wrapper = mount(RawPreview)
    const container = wrapper.find('.bg-zinc-900')
    expect(container.exists()).toBe(true)
  })

  it('uses monospace font', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore({
      rawText: 'test',
    }) as any)

    const wrapper = mount(RawPreview)
    const pre = wrapper.find('pre')
    expect(pre.classes()).toContain('font-mono')
  })
})
