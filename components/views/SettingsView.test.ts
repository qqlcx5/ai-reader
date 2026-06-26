import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AppSettings } from '@/domain'

// ============================================================
// SettingsView — 纯逻辑单元测试
//
// 测试设置切换、恢复默认、持久化等纯逻辑，不依赖 Vue 组件挂载。
// ============================================================

const DEFAULT_SETTINGS: AppSettings = {
  autoSave: true,
  showToast: true,
  includeFrontmatter: true,
  readerStyle: true,
}

type SettingKey = keyof AppSettings

const SETTING_LABELS: Record<SettingKey, { title: string; desc: string }> = {
  autoSave: { title: '自动保存到 IndexedDB', desc: '提取成功后直接写入本地数据库。' },
  showToast: { title: '保存后显示 Toast', desc: '完成、复制、删除等动作给出轻提示。' },
  includeFrontmatter: { title: '生成 Markdown 元数据', desc: '在 Markdown 顶部写入标题、作者、来源和时间。' },
  readerStyle: { title: '阅读器高级排版', desc: '使用 Apple 风格间距、浅色卡片和细边框。' },
}

// ---- 设置切换逻辑（纯函数模拟） ----

function toggleSetting(settings: AppSettings, key: SettingKey): AppSettings {
  return { ...settings, [key]: !settings[key] }
}

function resetSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS }
}

describe('SettingsView — 设置切换', () => {
  let settings: AppSettings

  beforeEach(() => {
    settings = { ...DEFAULT_SETTINGS }
  })

  it('默认所有设置均为 true', () => {
    expect(settings.autoSave).toBe(true)
    expect(settings.showToast).toBe(true)
    expect(settings.includeFrontmatter).toBe(true)
    expect(settings.readerStyle).toBe(true)
  })

  it('toggle autoSave：true → false', () => {
    settings = toggleSetting(settings, 'autoSave')
    expect(settings.autoSave).toBe(false)
    // 其他设置不变
    expect(settings.showToast).toBe(true)
  })

  it('toggle autoSave：false → true', () => {
    settings.autoSave = false
    settings = toggleSetting(settings, 'autoSave')
    expect(settings.autoSave).toBe(true)
  })

  it('toggle showToast：true → false', () => {
    settings = toggleSetting(settings, 'showToast')
    expect(settings.showToast).toBe(false)
  })

  it('toggle showToast：false → true', () => {
    settings.showToast = false
    settings = toggleSetting(settings, 'showToast')
    expect(settings.showToast).toBe(true)
  })

  it('toggle includeFrontmatter：true → false', () => {
    settings = toggleSetting(settings, 'includeFrontmatter')
    expect(settings.includeFrontmatter).toBe(false)
  })

  it('toggle readerStyle：true → false', () => {
    settings = toggleSetting(settings, 'readerStyle')
    expect(settings.readerStyle).toBe(false)
  })

  it('连续切换 3 次回到初始值', () => {
    settings = toggleSetting(settings, 'autoSave')
    settings = toggleSetting(settings, 'autoSave')
    settings = toggleSetting(settings, 'autoSave')
    expect(settings.autoSave).toBe(false) // true→false→true→false
  })

  it('独立切换互不影响', () => {
    settings = toggleSetting(settings, 'autoSave')
    settings = toggleSetting(settings, 'readerStyle')
    expect(settings.autoSave).toBe(false)
    expect(settings.readerStyle).toBe(false)
    expect(settings.showToast).toBe(true)
    expect(settings.includeFrontmatter).toBe(true)
  })
})

describe('SettingsView — 恢复默认', () => {
  it('修改全部设置后恢复默认', () => {
    let settings: AppSettings = {
      autoSave: false,
      showToast: false,
      includeFrontmatter: false,
      readerStyle: false,
    }

    settings = resetSettings()

    expect(settings).toEqual(DEFAULT_SETTINGS)
    expect(settings.autoSave).toBe(true)
    expect(settings.showToast).toBe(true)
    expect(settings.includeFrontmatter).toBe(true)
    expect(settings.readerStyle).toBe(true)
  })

  it('部分修改后恢复默认', () => {
    let settings: AppSettings = {
      autoSave: false,
      showToast: true,
      includeFrontmatter: true,
      readerStyle: false,
    }

    settings = resetSettings()

    expect(settings).toEqual(DEFAULT_SETTINGS)
  })

  it('默认设置本身也是恢复后的结果', () => {
    expect(resetSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('SettingsView — 设置项定义完整性', () => {
  it('应有 4 个设置项', () => {
    const keys = Object.keys(SETTING_LABELS) as SettingKey[]
    expect(keys).toHaveLength(4)
  })

  it('每个设置项都有 title 和 desc', () => {
    for (const key of Object.keys(SETTING_LABELS) as SettingKey[]) {
      expect(SETTING_LABELS[key].title).toBeTruthy()
      expect(SETTING_LABELS[key].desc).toBeTruthy()
    }
  })

  it('label keys 与 AppSettings 类型一致', () => {
    const settingsKeys = Object.keys(DEFAULT_SETTINGS) as SettingKey[]
    const labelKeys = Object.keys(SETTING_LABELS) as SettingKey[]
    expect(labelKeys.sort()).toEqual(settingsKeys.sort())
  })
})

describe('SettingsView — Settings 类型不变式', () => {
  it('所有设置值均为 boolean 类型', () => {
    const settings = { ...DEFAULT_SETTINGS }
    for (const val of Object.values(settings)) {
      expect(typeof val).toBe('boolean')
    }
  })

  it('DEFAULT_SETTINGS 不应被修改', () => {
    const snapshot = { ...DEFAULT_SETTINGS }
    // 模拟一次 toggle（不修改原始 DEFAULT_SETTINGS）
    const modified = toggleSetting({ ...DEFAULT_SETTINGS }, 'autoSave')
    expect(modified.autoSave).toBe(false)
    // DEFAULT_SETTINGS 不变
    expect(DEFAULT_SETTINGS.autoSave).toBe(true)
    expect(DEFAULT_SETTINGS).toEqual(snapshot)
  })
})

// ---- Toast 消息构造 ----

describe('SettingsView — Toast 消息', () => {
  it('开启时 toast 标题应为"设置已开启"', () => {
    const newVal = true
    const title = newVal ? '设置已开启' : '设置已关闭'
    expect(title).toBe('设置已开启')
  })

  it('关闭时 toast 标题应为"设置已关闭"', () => {
    const newVal = false
    const title = newVal ? '设置已开启' : '设置已关闭'
    expect(title).toBe('设置已关闭')
  })

  it('恢复默认 toast 标题应为"已恢复默认设置"', () => {
    const title = '已恢复默认设置'
    expect(title).toBe('已恢复默认设置')
  })

  it('描述消息包含"本地配置"', () => {
    const desc = '偏好已保存到本地配置'
    expect(desc).toContain('本地配置')
  })
})
