import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import WorkspaceHeader from './WorkspaceHeader.vue'

// Mock dependencies
vi.mock('../../services/capture/capture.service', () => ({
  requestExtract: vi.fn(),
}))

vi.mock('../../utils/date', () => ({
  nowISO: () => '2026-06-28T00:00:00.000Z',
}))

// Stub lucide icon
vi.mock('@lucide/vue', () => ({
  RefreshCw: {
    name: 'RefreshCw',
    template: '<span class="mock-refresh-cw" />',
    props: ['class', 'size'],
  },
}))

function createMockDocumentStore() {
  return reactive({
    currentDocument: {
      id: 'abc123',
      url: 'https://example.com/test-page',
      title: 'Test Document',
      markdown: '# Test',
      wordCount: 100,
      tokenCount: 250,
      contentHash: 'abc123',
      extractionMethod: 'defuddle',
      source: 'current-page',
      capturedAt: '2026-06-28T00:00:00Z',
      updatedAt: '2026-06-28T00:00:00Z',
    },
    pageDocument: null,
    documents: [],
    isLoading: false,
    setCurrentDocument: vi.fn(),
    setPageDocument: vi.fn(),
    saveDocument: vi.fn().mockResolvedValue(undefined),
  })
}

function createMockWorkspaceStore(overrides?: Partial<{ documentSource: string; captureStatus: string }>) {
  return reactive({
    captureStatus: overrides?.captureStatus ?? 'ready',
    documentSource: overrides?.documentSource ?? 'current-page',
    isExtracting: false,
    setExtracting: vi.fn(),
    setCaptureStatus: vi.fn(),
  })
}

function createMockAppStore() {
  return reactive({
    activeTab: {
      id: 1,
      url: 'https://example.com/test-page',
      title: 'Test Document',
    },
    showToast: vi.fn(),
  })
}

vi.mock('../../stores/document.store', () => ({
  useDocumentStore: vi.fn(),
}))

vi.mock('../../stores/workspace.store', () => ({
  useWorkspaceStore: vi.fn(),
}))

vi.mock('../../stores/app.store', () => ({
  useAppStore: vi.fn(),
}))

import { useDocumentStore } from '../../stores/document.store'
import { useWorkspaceStore } from '../../stores/workspace.store'
import { useAppStore } from '../../stores/app.store'

const mockDocStore = vi.mocked(useDocumentStore)
const mockWspStore = vi.mocked(useWorkspaceStore)
const mockAppStore = vi.mocked(useAppStore)

describe('WorkspaceHeader', () => {
  let docStore: ReturnType<typeof createMockDocumentStore>
  let wspStore: ReturnType<typeof createMockWorkspaceStore>
  let appStore: ReturnType<typeof createMockAppStore>

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)

    docStore = createMockDocumentStore()
    wspStore = createMockWorkspaceStore()
    appStore = createMockAppStore()

    mockDocStore.mockReturnValue(docStore as any)
    mockWspStore.mockReturnValue(wspStore as any)
    mockAppStore.mockReturnValue(appStore as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders document title', () => {
    const wrapper = mount(WorkspaceHeader, {
      global: {
        stubs: { RefreshCw: true },
      },
    })

    expect(wrapper.text()).toContain('Test Document')
  })

  it('renders domain name from URL', () => {
    const wrapper = mount(WorkspaceHeader, {
      global: {
        stubs: { RefreshCw: true },
      },
    })

    expect(wrapper.text()).toContain('example.com')
  })

  it('renders token count', () => {
    const wrapper = mount(WorkspaceHeader, {
      global: {
        stubs: { RefreshCw: true },
      },
    })

    expect(wrapper.text()).toContain('250')
  })

  it('shows refresh button when source is current-page', () => {
    const wrapper = mount(WorkspaceHeader, {
      global: {
        stubs: { RefreshCw: true },
      },
    })

    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('shows refresh button even when source is library', () => {
    ;(wspStore as any).documentSource = 'library'

    const wrapper = mount(WorkspaceHeader, {
      global: {
        stubs: { RefreshCw: true },
      },
    })

    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
  })

  it('shows correct status color for idle', () => {
    ;(wspStore as any).captureStatus = 'idle'

    const wrapper = mount(WorkspaceHeader, {
      global: {
        stubs: { RefreshCw: true },
      },
    })

    const dots = wrapper.findAll('.w-1\\.5.h-1\\.5.rounded-full')
    expect(dots.length).toBeGreaterThan(0)
    expect(dots[0].classes()).toContain('bg-zinc-300')
  })

  it('shows correct status color for extracting', () => {
    ;(wspStore as any).captureStatus = 'extracting'

    const wrapper = mount(WorkspaceHeader, {
      global: {
        stubs: { RefreshCw: true },
      },
    })

    const dots = wrapper.findAll('.w-1\\.5.h-1\\.5.rounded-full')
    expect(dots.length).toBeGreaterThan(0)
    expect(dots[0].classes()).toContain('bg-blue-400')
  })
})
