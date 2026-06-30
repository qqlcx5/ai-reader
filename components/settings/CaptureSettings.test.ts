import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import CaptureSettings from './CaptureSettings.vue'
import { useSettingsStore } from '@/stores/settings.store'

const settingsDb = new Map()

vi.mock('@/db/repositories/settings.repository', () => ({
  SettingsRepository: {
    get: vi.fn(async () => settingsDb.get('app-settings') || null),
    save: vi.fn(async (s: any) => { settingsDb.set('app-settings', s) }),
  },
}))

describe('CaptureSettings', () => {
  beforeEach(() => {
    settingsDb.clear()
    setActivePinia(createPinia())
  })

  it('renders all three capture toggles', async () => {
    const store = useSettingsStore()
    await store.loadSettings()
    const wrapper = mount(CaptureSettings)
    expect(wrapper.text()).toContain('打开面板时自动抓取')
    expect(wrapper.text()).toContain('切换标签时自动抓取')
    expect(wrapper.text()).toContain('优先使用缓存')
  })

  it('renders subtitle descriptions', async () => {
    const store = useSettingsStore()
    await store.loadSettings()
    const wrapper = mount(CaptureSettings)
    expect(wrapper.text()).toContain('Side Panel 打开时自动提取当前页面内容')
    expect(wrapper.text()).toContain('浏览器标签页切换时自动提取新页面')
  })

  it('autoExtractOnOpen is enabled by default', async () => {
    const store = useSettingsStore()
    await store.loadSettings()
    expect(store.settings.capture.autoExtractOnOpen).toBe(true)
  })

  it('autoExtractOnTabChange is false by default', async () => {
    const store = useSettingsStore()
    await store.loadSettings()
    expect(store.settings.capture.autoExtractOnTabChange).toBe(false)
  })
})
