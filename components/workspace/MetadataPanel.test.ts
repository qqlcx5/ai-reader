import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import MetadataPanel from './MetadataPanel.vue'

// Mock lucide icon
vi.mock('@lucide/vue', () => ({
  ExternalLink: {
    name: 'ExternalLink',
    template: '<span class="mock-external-link" />',
    props: ['class', 'size'],
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

describe('MetadataPanel', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const fullDoc = {
    title: 'Test Page',
    url: 'https://example.com/article',
    canonicalUrl: 'https://example.com/article?canonical',
    siteName: 'Example Site',
    author: 'John Doe',
    description: 'A test article',
    publishedAt: '2026-01-15T00:00:00Z',
    capturedAt: '2026-06-28T12:00:00Z',
    updatedAt: '2026-06-28T12:30:00Z',
    wordCount: 1500,
    tokenCount: 750,
    extractionMethod: 'defuddle',
    contentHash: 'abc123def456',
    source: 'current-page',
  }

  it('renders all metadata fields with values', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore(fullDoc) as any)

    const wrapper = mount(MetadataPanel)
    const text = wrapper.text()

    expect(text).toContain('标题')
    expect(text).toContain('Test Page')
    expect(text).toContain('URL')
    expect(text).toContain('example.com')
    expect(text).toContain('Canonical URL')
    expect(text).toContain('站点名称')
    expect(text).toContain('Example Site')
    expect(text).toContain('作者')
    expect(text).toContain('John Doe')
    expect(text).toContain('描述')
    expect(text).toContain('A test article')
    expect(text).toContain('发布时间')
    expect(text).toContain('抓取时间')
    expect(text).toContain('更新时间')
    expect(text).toContain('字数')
    expect(text).toContain('1,500')
    expect(text).toContain('Token 数')
    expect(text).toContain('750')
    expect(text).toContain('抓取方式')
    expect(text).toContain('defuddle')
    expect(text).toContain('内容哈希')
    expect(text).toContain('abc123def456')
    expect(text).toContain('来源')
    expect(text).toContain('current-page')
  })

  it('shows dash for empty fields', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore({
      title: '',
      url: '',
    }) as any)

    const wrapper = mount(MetadataPanel)

    // Should have dash indicators
    const dashes = wrapper.findAll('.text-zinc-300')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders URL as clickable link', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore(fullDoc) as any)

    const wrapper = mount(MetadataPanel)
    const link = wrapper.find('a[href]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://example.com/article')
    expect(link.attributes('target')).toBe('_blank')
  })

  it('displays two-column grid layout', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore(fullDoc) as any)

    const wrapper = mount(MetadataPanel)
    const grid = wrapper.find('.grid.grid-cols-2')
    expect(grid.exists()).toBe(true)
  })

  it('formats wordCount and tokenCount with locale', () => {
    mockDocStore.mockReturnValue(createMockDocumentStore({
      ...fullDoc,
      wordCount: 12345,
      tokenCount: 5678,
    }) as any)

    const wrapper = mount(MetadataPanel)
    const text = wrapper.text()
    expect(text).toContain('12,345')
    expect(text).toContain('5,678')
  })
})
