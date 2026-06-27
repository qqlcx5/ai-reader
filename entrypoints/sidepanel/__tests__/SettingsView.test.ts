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

  it('renders LLM config section', () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          Key: { template: '<svg />' },
          ShieldCheck: { template: '<svg />' },
          Cloud: { template: '<svg />' },
          FileJson: { template: '<svg />' },
          Upload: { template: '<svg />' },
          Package: { template: '<svg />' },
          Eye: { template: '<svg />' },
          EyeOff: { template: '<svg />' },
          ArrowLeft: { template: '<svg />' },
        },
      },
    })
    expect(wrapper.text()).toContain('LLM 模型服务商配置')
    expect(wrapper.text()).toContain('AES-GCM 本地加密')
    expect(wrapper.text()).toContain('API ENDPOINT')
    expect(wrapper.text()).toContain('API KEY')
  })

  it('renders WebDAV sync section', () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          Key: { template: '<svg />' },
          ShieldCheck: { template: '<svg />' },
          Cloud: { template: '<svg />' },
          FileJson: { template: '<svg />' },
          Upload: { template: '<svg />' },
          Package: { template: '<svg />' },
          Eye: { template: '<svg />' },
          EyeOff: { template: '<svg />' },
          ArrowLeft: { template: '<svg />' },
        },
      },
    })
    expect(wrapper.text()).toContain('WebDAV')
    expect(wrapper.text()).toContain('坚果云')
    expect(wrapper.text()).toContain('WEBDAV 账号')
    expect(wrapper.text()).toContain('同步校验密码')
  })

  it('renders backup section', () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          Key: { template: '<svg />' },
          ShieldCheck: { template: '<svg />' },
          Cloud: { template: '<svg />' },
          FileJson: { template: '<svg />' },
          Upload: { template: '<svg />' },
          Package: { template: '<svg />' },
          Eye: { template: '<svg />' },
          EyeOff: { template: '<svg />' },
          ArrowLeft: { template: '<svg />' },
        },
      },
    })
    expect(wrapper.text()).toContain('导出 JSON 备份')
    expect(wrapper.text()).toContain('导入恢复数据')
    expect(wrapper.text()).toContain('一键打包导出 Obsidian')
  })

  it('renders back button', () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          Key: { template: '<svg />' },
          ShieldCheck: { template: '<svg />' },
          Cloud: { template: '<svg />' },
          FileJson: { template: '<svg />' },
          Upload: { template: '<svg />' },
          Package: { template: '<svg />' },
          Eye: { template: '<svg />' },
          EyeOff: { template: '<svg />' },
          ArrowLeft: { template: '<svg />' },
        },
      },
    })
    expect(wrapper.text()).toContain('返回')
  })

  // Store-level tests (still valid)
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
})
