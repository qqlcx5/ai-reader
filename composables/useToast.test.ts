import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { reactive, h, defineComponent, nextTick, createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { provideToast, useToast, type ToastContext } from './useToast'
import type { AppSettings } from '@/domain'

// ---- Mock settings store ----

const mockedSettings: AppSettings = reactive({
  autoSave: true,
  showToast: true,
  includeFrontmatter: true,
  readerStyle: true,
})

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: () => ({
    settings: mockedSettings,
    loading: { value: false },
    loadSettings: vi.fn(),
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
  }),
}))

// ---- Test helpers ----

/** Mount a component that calls provideToast() and captures the context. */
async function mountToastProvider(): Promise<{
  ctx: ToastContext
  setShowToast: (v: boolean) => void
}> {
  let captured: ToastContext | null = null

  const Provider = defineComponent({
    setup() {
      const ctx = provideToast()
      captured = ctx
      return () => h('div')
    },
  })

  const pinia = createPinia()
  setActivePinia(pinia)

  const app = createApp(Provider)
  app.use(pinia)
  const rootEl = document.createElement('div')
  app.mount(rootEl)

  await nextTick()

  return {
    ctx: captured!,
    setShowToast: (v: boolean) => {
      mockedSettings.showToast = v
    },
  }
}

afterEach(() => {
  // Reset DOM
  document.body.innerHTML = ''
})

// ---- Tests ----

describe('useToast', () => {
  beforeEach(() => {
    Object.assign(mockedSettings, {
      autoSave: true,
      showToast: true,
      includeFrontmatter: true,
      readerStyle: true,
    })
  })

  // -- 1. Toast 显示测试 --

  describe('显示/消失', () => {
    it('调用 showToast 后 toast 立即可见', async () => {
      const { ctx } = await mountToastProvider()

      expect(ctx.toast.value).toBeNull()

      ctx.showToast('success', '保存成功', '已保存到本地')

      expect(ctx.toast.value).not.toBeNull()
      expect(ctx.toast.value!.type).toBe('success')
      expect(ctx.toast.value!.title).toBe('保存成功')
      expect(ctx.toast.value!.description).toBe('已保存到本地')
    })

    it('默认 duration 为 2200ms', async () => {
      const { ctx } = await mountToastProvider()

      ctx.showToast('info', '测试')

      expect(ctx.toast.value!.duration).toBe(2200)
    })

    it('支持自定义 duration', async () => {
      const { ctx } = await mountToastProvider()

      ctx.showToast('error', '错误', '描述', 5000)

      expect(ctx.toast.value!.duration).toBe(5000)
    })

    it('新 Toast 替换当前 Toast（队列策略）', async () => {
      const { ctx } = await mountToastProvider()

      ctx.showToast('success', '第一个', '描述1')
      expect(ctx.toast.value!.title).toBe('第一个')

      ctx.showToast('error', '第二个', '描述2')
      expect(ctx.toast.value!.title).toBe('第二个')
      expect(ctx.toast.value!.type).toBe('error')
    })

    it('desc 参数可选', async () => {
      const { ctx } = await mountToastProvider()

      ctx.showToast('info', '仅标题')

      expect(ctx.toast.value!.description).toBeUndefined()
    })
  })

  // -- 2. Toast 类型测试 --

  describe('类型区分', () => {
    it('success 类型正确', async () => {
      const { ctx } = await mountToastProvider()
      ctx.showToast('success', '成功', '描述')
      expect(ctx.toast.value!.type).toBe('success')
    })

    it('error 类型正确', async () => {
      const { ctx } = await mountToastProvider()
      ctx.showToast('error', '错误', '描述')
      expect(ctx.toast.value!.type).toBe('error')
    })

    it('info 类型正确', async () => {
      const { ctx } = await mountToastProvider()
      ctx.showToast('info', '信息', '描述')
      expect(ctx.toast.value!.type).toBe('info')
    })
  })

  // -- 3. 静默模式测试 --

  describe('静默模式 (showToast: false)', () => {
    it('showToast: false 时不设置 toast', async () => {
      const { ctx, setShowToast } = await mountToastProvider()

      // Enable silent mode
      setShowToast(false)

      ctx.showToast('success', '不应该出现')

      expect(ctx.toast.value).toBeNull()
    })

    it('showToast 从 false 切回 true 后恢复显示', async () => {
      const { ctx, setShowToast } = await mountToastProvider()

      setShowToast(false)
      ctx.showToast('success', '静默')
      expect(ctx.toast.value).toBeNull()

      setShowToast(true)
      ctx.showToast('success', '可见')
      expect(ctx.toast.value).not.toBeNull()
      expect(ctx.toast.value!.title).toBe('可见')
    })
  })

  // -- 4. useToast inject --

  describe('useToast() inject', () => {
    it('应在 provideToast 后代中可用', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)

      let childToast: ToastContext | null = null

      const Child = defineComponent({
        setup() {
          childToast = useToast()
          return () => h('div')
        },
      })

      const Parent = defineComponent({
        setup() {
          provideToast()
          return () => h(Child)
        },
      })

      const app = createApp(Parent)
      app.use(pinia)
      const rootEl = document.createElement('div')
      app.mount(rootEl)

      await nextTick()

      expect(childToast).not.toBeNull()
      childToast!.showToast('info', '来自子组件')
      expect(childToast!.toast.value!.title).toBe('来自子组件')
    })

    it('未 provide 时 useToast 应抛出错误', () => {
      expect(() => useToast()).toThrow('useToast() must be used within a component that calls provideToast()')
    })
  })
})
