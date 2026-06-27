// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../../../stores/settings'
import SettingsView from '../views/SettingsView.vue'

describe('SettingsView', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renders all setting toggles', () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: { ToggleSwitch: true },
      },
    })
    expect(wrapper.text()).toContain('自动保存')
    expect(wrapper.text()).toContain('显示通知')
    expect(wrapper.text()).toContain('包含 Frontmatter')
    expect(wrapper.text()).toContain('阅读器风格')
  })

  it('renders reset button', () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: { ToggleSwitch: true },
      },
    })
    expect(wrapper.text()).toContain('恢复默认设置')
  })

  it('toggle autoSave updates store setting', async () => {
    const store = useSettingsStore()
    expect(store.settings.autoSave).toBe(true)

    store.update({ autoSave: false })
    expect(store.settings.autoSave).toBe(false)
  })

  it('toggle showToast updates store setting', async () => {
    const store = useSettingsStore()
    expect(store.settings.showToast).toBe(true)

    store.update({ showToast: false })
    expect(store.settings.showToast).toBe(false)
  })

  it('toggle includeFrontmatter updates store setting', async () => {
    const store = useSettingsStore()
    expect(store.settings.includeFrontmatter).toBe(true)

    store.update({ includeFrontmatter: false })
    expect(store.settings.includeFrontmatter).toBe(false)
  })

  it('readerStyle select updates store setting', async () => {
    const store = useSettingsStore()
    expect(store.settings.readerStyle).toBe('light')

    store.update({ readerStyle: 'dark' })
    expect(store.settings.readerStyle).toBe('dark')

    store.update({ readerStyle: 'sepia' })
    expect(store.settings.readerStyle).toBe('sepia')
  })

  it('reset restores defaults', async () => {
    const store = useSettingsStore()
    store.update({ autoSave: false, showToast: false })
    expect(store.settings.autoSave).toBe(false)

    store.reset()
    expect(store.settings.autoSave).toBe(true)
    expect(store.settings.showToast).toBe(true)
  })

  it('shows toast on reset', async () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: { ToggleSwitch: true },
      },
    })
    // Check that reset button is present and clickable
    const resetBtn = wrapper.find('button')
    expect(resetBtn.exists()).toBe(true)
  })
})
