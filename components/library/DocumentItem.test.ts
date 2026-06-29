import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DocumentItem from './DocumentItem.vue'
import type { DocumentEntity } from '@/types/document'

function makeDoc(overrides: Partial<DocumentEntity> = {}): DocumentEntity {
  return {
    id: 'doc-1',
    url: 'https://example.com/article',
    title: 'Test Article',
    siteName: 'example.com',
    markdown: '# Heading\nContent here',
    excerpt: 'Brief excerpt of the article...',
    canonicalUrl: 'https://example.com/article',
    capturedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    wordCount: 500,
    tokenCount: 600,
    contentHash: 'hash123',
    rawHtml: undefined,
    extractionMethod: 'manual',
    source: 'library' as const,
    ...overrides,
  }
}

describe('DocumentItem', () => {
  it('renders document title', () => {
    const wrapper = mount(DocumentItem, {
      props: { document: makeDoc() },
    })
    expect(wrapper.text()).toContain('Test Article')
  })

  it('renders domain from siteName', () => {
    const wrapper = mount(DocumentItem, {
      props: { document: makeDoc({ siteName: 'MySite' }) },
    })
    expect(wrapper.text()).toContain('MySite')
  })

  it('renders domain from URL when siteName is empty', () => {
    const wrapper = mount(DocumentItem, {
      props: { document: makeDoc({ siteName: '', url: 'https://docs.example.com/guide' }) },
    })
    expect(wrapper.text()).toContain('docs.example.com')
  })

  it('emits select on click', async () => {
    const doc = makeDoc()
    const wrapper = mount(DocumentItem, {
      props: { document: doc },
    })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual([doc])
  })

  it('emits chat on message button click', async () => {
    const doc = makeDoc()
    const wrapper = mount(DocumentItem, {
      props: { document: doc },
    })
    await wrapper.find('button[class*="text-brand"]').trigger('click')
    expect(wrapper.emitted('chat')).toBeTruthy()
  })

  it('emits delete on trash button click', async () => {
    const doc = makeDoc()
    const wrapper = mount(DocumentItem, {
      props: { document: doc },
    })
    await wrapper.find('button[class*="text-red"]').trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
  })

  it('emits openUrl on external link button click', async () => {
    const doc = makeDoc()
    const wrapper = mount(DocumentItem, {
      props: { document: doc },
    })
    const buttons = wrapper.findAll('button')
    const openBtn = buttons.find((b) => b.text() === '') // ExternalLink icon has no text
    // Find the first button with text-zinc-500
    const allButtons = wrapper.findAll('button')
    const externalButton = allButtons.find((b) => b.classes().some((c) => c.includes('text-zinc-500')) && b.classes().some((c) => c.includes('hover:bg-zinc-100')))
    expect(externalButton).toBeTruthy()
    if (externalButton) {
      await externalButton.trigger('click')
      expect(wrapper.emitted('openUrl')).toBeTruthy()
    }
  })

  it('renders time ago for recent documents', () => {
    const now = new Date()
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60000).toISOString()
    const wrapper = mount(DocumentItem, {
      props: { document: makeDoc({ capturedAt: tenMinutesAgo }) },
    })
    expect(wrapper.text()).toContain('分钟前')
  })

  it('renders date for old documents', () => {
    const wrapper = mount(DocumentItem, {
      props: { document: makeDoc({ capturedAt: '2025-01-15T10:00:00Z' }) },
    })
    expect(wrapper.text()).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('renders excerpt text without markdown chars', () => {
    const wrapper = mount(DocumentItem, {
      props: { document: makeDoc({ excerpt: '**Bold** and *italic* text' }) },
    })
    expect(wrapper.text()).not.toContain('**')
    expect(wrapper.text()).not.toContain('*')
    expect(wrapper.text()).toContain('Bold')
  })

  it('shows unread dot when lastOpenedAt is absent', () => {
    const wrapper = mount(DocumentItem, { props: { document: makeDoc() } })
    expect(wrapper.find('span.bg-brand').exists()).toBe(true)
  })

  it('hides unread dot when lastOpenedAt is set', () => {
    const wrapper = mount(DocumentItem, {
      props: { document: makeDoc({ lastOpenedAt: '2026-06-20T00:00:00Z' }) },
    })
    expect(wrapper.find('span.bg-brand').exists()).toBe(false)
  })

  it('shows 已对话 badge when hasConversation is true', () => {
    const wrapper = mount(DocumentItem, {
      props: { document: makeDoc(), hasConversation: true },
    })
    expect(wrapper.text()).toContain('已对话')
  })

  it('does not show 已对话 badge by default', () => {
    const wrapper = mount(DocumentItem, { props: { document: makeDoc() } })
    expect(wrapper.text()).not.toContain('已对话')
  })
})
