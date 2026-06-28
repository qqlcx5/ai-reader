import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ContextSettings from './ContextSettings.vue'
import { useSettingsStore } from '@/stores/settings.store'

// jsdom polyfill for reka-ui Slider ResizeObserver
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any

// Mock SettingsRepository
const settingsDb = new Map()

vi.mock('@/db/repositories/settings.repository', () => ({
  SettingsRepository: {
    get: vi.fn(async () => settingsDb.get('app-settings') || null),
    save: vi.fn(async (s: any) => { settingsDb.set('app-settings', s) }),
  },
}))

describe('ContextSettings', () => {
  beforeEach(() => {
    settingsDb.clear()
    setActivePinia(createPinia())
  })

  it('renders token limit slider', async () => {
    const store = useSettingsStore()
    await store.loadSettings()
    const wrapper = mount(ContextSettings)
    expect(wrapper.text()).toContain('注入窗口大小限制')
  })

  it('renders all metadata toggle labels', async () => {
    const store = useSettingsStore()
    await store.loadSettings()
    const wrapper = mount(ContextSettings)
    expect(wrapper.text()).toContain('包含 URL')
    expect(wrapper.text()).toContain('包含标题')
    expect(wrapper.text()).toContain('包含捕获时间')
    expect(wrapper.text()).toContain('在 Prompt 中包含元数据')
  })

  it('renders conversation history section', async () => {
    const store = useSettingsStore()
    await store.loadSettings()
    const wrapper = mount(ContextSettings)
    expect(wrapper.text()).toContain('包含对话历史')
  })

  it('updates tokens when slider changes', async () => {
    const store = useSettingsStore()
    await store.loadSettings()
    const wrapper = mount(ContextSettings)

    const slider = wrapper.findComponent({ name: 'Slider' })
    expect(slider.exists()).toBe(true)

    await slider.vm.$emit('update:modelValue', 16)
    expect(store.settings.context.maxContextTokens).toBe(16000)
  })
})
