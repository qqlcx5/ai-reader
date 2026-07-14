import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import ContextPanel from './ContextPanel.vue'

// Mock lucide icons
vi.mock('@lucide/vue', () => ({
  Copy: {
    name: 'Copy',
    template: '<span class="mock-copy" />',
    props: ['class', 'size'],
  },
  RefreshCw: {
    name: 'RefreshCw',
    template: '<span class="mock-refresh-cw" />',
    props: ['class', 'size'],
  },
  Trash2: {
    name: 'Trash2',
    template: '<span class="mock-trash2" />',
    props: ['class', 'size'],
  },
}))

// Mock capture service
vi.mock('@/services/capture/capture.service', () => ({
  requestExtract: vi.fn(),
}))

// Mock date utils
vi.mock('@/utils/date', () => ({
  nowISO: () => '2026-06-28T00:00:00.000Z',
}))

// Stub child components
vi.mock('@/components/workspace/MarkdownPreview.vue', () => ({
  default: {
    name: 'MarkdownPreview',
    template: '<div class="markdown-preview-stub" />',
  },
}))

vi.mock('@/components/workspace/RawPreview.vue', () => ({
  default: {
    name: 'RawPreview',
    template: '<div class="raw-preview-stub" />',
  },
}))

vi.mock('@/components/workspace/MetadataPanel.vue', () => ({
  default: {
    name: 'MetadataPanel',
    template: '<div class="metadata-panel-stub" />',
  },
}))

vi.mock('@/components/common/ConfirmModal.vue', () => ({
  default: {
    name: 'ConfirmModal',
    template: '<div class="confirm-modal-stub" />',
  },
}))

function createMockDocumentStore(doc: any) {
  return reactive({
    currentDocument: doc,
    pageDocument: null,
    setCurrentDocument: vi.fn(),
    setPageDocument: vi.fn(),
    saveDocument: vi.fn().mockResolvedValue(undefined),
  })
}

function createMockWorkspaceStore(overrides?: any) {
  return reactive({
    currentContextTab: 'markdown',
    captureStatus: 'ready',
    documentSource: 'current-page',
    isExtracting: false,
    setContextTab: vi.fn(),
    setExtracting: vi.fn(),
    setCaptureStatus: vi.fn(),
    ...overrides,
  })
}

function createMockAppStore() {
  return reactive({
    activeTab: { id: 1, url: 'https://example.com', title: 'Test' },
    showToast: vi.fn(),
  })
}

function createMockChatStore() {
  return reactive({
    resetState: vi.fn(),
  })
}

vi.mock('@/stores/document.store', () => ({
  useDocumentStore: vi.fn(),
}))

vi.mock('@/stores/workspace.store', () => ({
  useWorkspaceStore: vi.fn(),
}))

vi.mock('@/stores/app.store', () => ({
  useAppStore: vi.fn(),
}))

vi.mock('@/stores/chat.store', () => ({
  useChatStore: vi.fn(),
}))

import { useDocumentStore } from '@/stores/document.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useAppStore } from '@/stores/app.store'
import { useChatStore } from '@/stores/chat.store'

const mockDocStore = vi.mocked(useDocumentStore)
const mockWspStore = vi.mocked(useWorkspaceStore)
const mockAppStore = vi.mocked(useAppStore)
const mockChatStore = vi.mocked(useChatStore)

describe('ContextPanel', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)

    mockDocStore.mockReturnValue(createMockDocumentStore({
      markdown: '# Test Markdown',
    }) as any)
    mockWspStore.mockReturnValue(createMockWorkspaceStore() as any)
    mockAppStore.mockReturnValue(createMockAppStore() as any)
    mockChatStore.mockReturnValue(createMockChatStore() as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders four tabs', () => {
    const wrapper = mount(ContextPanel)

    const triggers = wrapper.findAll('[role="tab"]')
    expect(triggers.length).toBe(4)
  })

  it('tab labels are Markdown, 标注, Raw, 元数据', () => {
    const wrapper = mount(ContextPanel)

    const text = wrapper.text()
    expect(text).toContain('Markdown')
    expect(text).toContain('标注')
    expect(text).toContain('Raw')
    expect(text).toContain('元数据')
  })

  it('shows markdown preview when markdown tab is active', () => {
    const wspStore = createMockWorkspaceStore({ currentContextTab: 'markdown' })
    mockWspStore.mockReturnValue(wspStore as any)

    const wrapper = mount(ContextPanel)
    expect(wrapper.find('.markdown-preview-stub').exists()).toBe(true)
  })

  it('shows raw preview when raw tab is active', () => {
    const wspStore = createMockWorkspaceStore({ currentContextTab: 'raw' })
    mockWspStore.mockReturnValue(wspStore as any)

    const wrapper = mount(ContextPanel)
    expect(wrapper.find('.raw-preview-stub').exists()).toBe(true)
  })

  it('shows metadata panel when metadata tab is active', () => {
    const wspStore = createMockWorkspaceStore({ currentContextTab: 'metadata' })
    mockWspStore.mockReturnValue(wspStore as any)

    const wrapper = mount(ContextPanel)
    expect(wrapper.find('.metadata-panel-stub').exists()).toBe(true)
  })

  it('has copy markdown button', () => {
    const wrapper = mount(ContextPanel)

    const copyBtn = wrapper.find('[title="复制当前标签页内容"]')
    expect(copyBtn.exists()).toBe(true)
  })

  it('shows refresh button when source is current-page', () => {
    const wrapper = mount(ContextPanel)

    const refreshBtn = wrapper.find('[title="刷新"]')
    expect(refreshBtn.exists()).toBe(true)
  })

  it('still shows refresh button when source is library', () => {
    const wspStore = createMockWorkspaceStore({ documentSource: 'library' })
    mockWspStore.mockReturnValue(wspStore as any)

    const wrapper = mount(ContextPanel)
    const refreshBtn = wrapper.find('[title="刷新"]')
    expect(refreshBtn.exists()).toBe(true)
  })

  it('shows a delete button next to copy/refresh', () => {
    const wrapper = mount(ContextPanel)
    const deleteBtn = wrapper.find('[title="从记忆库删除"]')
    expect(deleteBtn.exists()).toBe(true)
  })

  it('clicking delete opens a confirm modal and deletes on confirm', async () => {
    const doc = {
      id: 'doc-1',
      title: 'Test Page',
      markdown: '# Hi',
    }
    const docStore = createMockDocumentStore(doc) as any
    docStore.deleteDocument = vi.fn().mockResolvedValue(undefined)
    docStore.refreshDocuments = vi.fn().mockResolvedValue(undefined)
    mockDocStore.mockReturnValue(docStore)

    const wrapper = mount(ContextPanel)

    // No modal initially
    expect(wrapper.find('.confirm-modal-stub').exists()).toBe(false)

    // Click delete -> modal appears
    await wrapper.find('[title="从记忆库删除"]').trigger('click')
    expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true)

    // Click confirm in modal -> deleteDocument + refresh + reset + setSource
    await wrapper.findComponent({ name: 'ConfirmModal' }).vm.$emit('confirm')

    // Wait for the async confirmDelete to settle
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(docStore.deleteDocument).toHaveBeenCalledWith('doc-1')
    expect(docStore.refreshDocuments).toHaveBeenCalled()
  })
})
