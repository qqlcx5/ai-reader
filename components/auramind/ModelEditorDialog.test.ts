import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ModelEditorDialog from './ModelEditorDialog.vue'
import type { ModelConfig } from '@/types/model'
import { useModelStore } from '@/stores/model.store'

vi.mock('@lucide/vue', () => ({
  X: { name: 'X', template: '<span class="mock-x" />', props: ['class', 'size'] },
  ChevronDown: { name: 'ChevronDown', template: '<span class="mock-chevron" />', props: ['class', 'size'] },
  RefreshCw: { name: 'RefreshCw', template: '<span class="mock-refresh" />', props: ['class', 'size'] },
  Search: { name: 'Search', template: '<span class="mock-search" />', props: ['class', 'size'] },
  Check: { name: 'Check', template: '<span class="mock-check" />', props: ['class', 'size'] },
}))

// Stub reka-ui components
vi.mock('reka-ui', () => {
  const stub = (name: string) => ({
    name,
    template: `<div class="stub-${name}"><slot /></div>`,
    props: ['modelValue', 'checked', 'options'],
  })
  return {
    SelectRoot: stub('SelectRoot'),
    SelectTrigger: stub('SelectTrigger'),
    SelectValue: stub('SelectValue'),
    SelectContent: stub('SelectContent'),
    SelectItem: stub('SelectItem'),
    SelectItemText: stub('SelectItemText'),
    SelectPortal: stub('SelectPortal'),
    SelectIcon: stub('SelectIcon'),
    SelectViewport: stub('SelectViewport'),
    SliderRoot: stub('SliderRoot'),
    SliderRange: stub('SliderRange'),
    SliderTrack: stub('SliderTrack'),
    SliderThumb: stub('SliderThumb'),
    SwitchRoot: stub('SwitchRoot'),
    SwitchThumb: stub('SwitchThumb'),
    DialogRoot: { name: 'DialogRoot', props: ['open'], template: '<div v-if="open" class="stub-DialogRoot"><slot /></div>' },
    DialogPortal: stub('DialogPortal'),
    DialogOverlay: stub('DialogOverlay'),
    DialogContent: stub('DialogContent'),
    DialogTitle: stub('DialogTitle'),
    DialogDescription: stub('DialogDescription'),
  }
})

function makeModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'm1',
    name: 'GPT-4',
    provider: 'openai-compatible',
    modelId: 'gpt-4',
    baseUrl: 'https://api.openai.com/v1',
    enabled: true,
    isDefault: false,
    contextWindow: 128000,
    temperature: 0.9,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('ModelEditorDialog — form validation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders add mode title when no modelId', () => {
    const wrapper = mount(ModelEditorDialog, {
      props: { open: true },
    })

    expect(wrapper.text()).toContain('添加模型节点')
  })

  it('renders edit mode title when modelId provided', () => {
    const store = useModelStore()
    store.$patch({ models: [makeModel({ id: 'm1' })] })

    const wrapper = mount(ModelEditorDialog, {
      props: { open: true, modelId: 'm1' },
    })

    expect(wrapper.text()).toContain('编辑模型')
  })

  it('should not render when open is false', () => {
    const wrapper = mount(ModelEditorDialog, {
      props: { open: false },
    })

    expect(wrapper.text()).not.toContain('添加模型节点')
  })

  it('emits close when clicking overlay', async () => {
    const wrapper = mount(ModelEditorDialog, {
      props: { open: true },
    })

    await wrapper.find('.stub-DialogOverlay').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('should show baseUrl field for openai-compatible provider', () => {
    const wrapper = mount(ModelEditorDialog, {
      props: { open: true },
    })

    expect(wrapper.text()).toContain('Base URL')
  })

  it('should show baseUrl field for ollama provider', () => {
    const store = useModelStore()
    store.$patch({ models: [makeModel({ id: 'm1', provider: 'ollama' })] })

    const wrapper = mount(ModelEditorDialog, {
      props: { open: true, modelId: 'm1' },
    })

    expect(wrapper.text()).toContain('Base URL')
  })

  it('should show all form fields', () => {
    const wrapper = mount(ModelEditorDialog, {
      props: { open: true },
    })

    const text = wrapper.text()
    expect(text).toContain('模型名称')
    expect(text).toContain('服务商类型')
    expect(text).toContain('模型 ID')
    expect(text).toContain('API Key')
    expect(text).toContain('上下文窗口')
    expect(text).toContain('温度')
    expect(text).toContain('System Prompt')
    expect(text).toContain('启用')
    expect(text).toContain('设为默认')
  })
})
