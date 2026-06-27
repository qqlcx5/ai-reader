// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useLibraryStore } from '../../../stores/library'
import ReaderView from '../views/ReaderView.vue'

describe('ReaderView', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  function createArticle(overrides: Partial<any> = {}) {
    return {
      id: 'test-reader-1',
      title: 'Reader Test Article',
      url: 'https://example.com/reader',
      siteName: 'Example Site',
      author: 'Author Name',
      publishedAt: '2024-06-01',
      excerpt: 'An excerpt for reader test',
      markdown: '# Hello\n\nThis is content.',
      contentHtml: '<h1>Hello</h1><p>This is content.</p>',
      contentText: 'Hello This is content.',
      faviconUrl: '',
      image: '',
      readingTime: 3,
      createdAt: '2024-06-01T00:00:00.000Z',
      updatedAt: '2024-06-01T00:00:00.000Z',
      ...overrides,
    }
  }

  it('shows empty state when no article selected', () => {
    const wrapper = mount(ReaderView, {
      global: {
        stubs: { IconButton: true },
      },
    })
    expect(wrapper.text()).toContain('未选择文章')
  })

  it('renders article content when selected', () => {
    const store = useLibraryStore()
    const article = createArticle()
    store.setArticles([article])
    store.selectArticle(article.id)
    const wrapper = mount(ReaderView, {
      global: {
        stubs: { IconButton: true },
      },
    })
    expect(wrapper.text()).toContain('Reader Test Article')
    expect(wrapper.text()).toContain('Example Site')
    expect(wrapper.text()).toContain('Author Name')
    expect(wrapper.text()).toContain('3 分钟')
  })

  it('shows metadata grid', () => {
    const store = useLibraryStore()
    const article = createArticle()
    store.setArticles([article])
    store.selectArticle(article.id)
    const wrapper = mount(ReaderView, {
      global: {
        stubs: { IconButton: true },
      },
    })
    expect(wrapper.text()).toContain('来源')
    expect(wrapper.text()).toContain('作者')
    expect(wrapper.text()).toContain('发布日期')
    expect(wrapper.text()).toContain('阅读时长')
    expect(wrapper.text()).toContain('站点')
  })

  it('shows export button', () => {
    const store = useLibraryStore()
    store.setArticles([createArticle()])
    store.selectArticle('test-reader-1')
    const wrapper = mount(ReaderView, {
      global: {
        stubs: { IconButton: true },
      },
    })
    expect(wrapper.text()).toContain('导出 Obsidian Markdown')
  })

  it('removes article from store on delete', async () => {
    const store = useLibraryStore()
    const article = createArticle()
    store.setArticles([article])
    store.selectArticle(article.id)
    // Simulate delete by directly calling action
    store.removeArticle(article.id)
    expect(store.articles.length).toBe(0)
    expect(store.selectedId).toBeNull()
  })
})
