// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useLibraryStore } from '../../../stores/library'
import LibraryView from '../views/LibraryView.vue'

describe('LibraryView', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  function createArticle(overrides: Partial<any> = {}) {
    return {
      id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: 'Test Article',
      url: 'https://example.com',
      siteName: 'Example',
      author: 'Tester',
      publishedAt: '2024-01-01',
      excerpt: 'A test excerpt',
      markdown: '# Hello\n\nWorld',
      contentHtml: '<h1>Hello</h1>',
      contentText: 'Hello World',
      faviconUrl: '',
      image: '',
      readingTime: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    }
  }

  it('shows empty state when no articles', () => {
    const wrapper = mount(LibraryView, {
      global: {
        stubs: {
          Search: { template: '<svg />' },
          Calendar: { template: '<svg />' },
          Globe: { template: '<svg />' },
          Cpu: { template: '<svg />' },
          Quote: { template: '<svg />' },
          Sparkles: { template: '<svg />' },
        },
      },
    })
    expect(wrapper.text()).toContain('剪藏的网页文章将展示于此')
  })

  it('renders articles from store', () => {
    const store = useLibraryStore()
    store.setArticles([createArticle({ title: 'My Article' })])
    const wrapper = mount(LibraryView, {
      global: {
        stubs: {
          Search: { template: '<svg />' },
          Calendar: { template: '<svg />' },
          Globe: { template: '<svg />' },
          Cpu: { template: '<svg />' },
          Quote: { template: '<svg />' },
          Sparkles: { template: '<svg />' },
        },
      },
    })
    expect(wrapper.text()).toContain('My Article')
  })

  it('filters articles by search query', async () => {
    const store = useLibraryStore()
    store.setArticles([
      createArticle({ id: '1', title: 'Vue Guide' }),
      createArticle({ id: '2', title: 'React Docs' }),
    ])
    const wrapper = mount(LibraryView, {
      global: {
        stubs: {
          Search: { template: '<svg />' },
          Calendar: { template: '<svg />' },
          Globe: { template: '<svg />' },
          Cpu: { template: '<svg />' },
          Quote: { template: '<svg />' },
          Sparkles: { template: '<svg />' },
        },
      },
    })

    const input = wrapper.find('input')
    await input.setValue('Vue')
    await new Promise((r) => setTimeout(r, 50))

    expect(wrapper.text()).toContain('Vue Guide')
    expect(wrapper.text()).not.toContain('React Docs')
  })
})
