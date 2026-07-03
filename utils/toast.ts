// utils/toast.ts
// 项目专用 Toast 封装，基于 vue-sonner
// 提供与原 appStore.showToast(message, type) 兼容的 API，
// 同时支持 promise / actions / 持续时间等高级用法。
import { toast as sonner } from 'vue-sonner'
import 'vue-sonner/style.css'

export type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'loading'

export interface ToastAction {
  label: string
  handler: () => void | Promise<void>
  primary?: boolean
}

export interface ToastOptions {
  /** 主标题 */
  title?: string
  /** 副描述 */
  description?: string
  /** 持续时间，ms；0 = 不自动消失 */
  duration?: number
  /** 按钮操作 */
  actions?: ToastAction[]
  /** 类型分类（用于过滤/统计） */
  category?: 'clip' | 'ai' | 'sync' | 'rss' | 'system'
}

/** 基础 show */
function show(message: string, options: ToastOptions = {}) {
  return sonner(message, normalize(options))
}

function normalize(options: ToastOptions) {
  const out: any = { ...options }
  // sonner 字段是 description，不是 title
  if (options.description === undefined && options.title !== undefined) {
    out.description = options.title
    delete out.title
  }
  // sonner 字段是 action / cancel，区别于我们的 actions
  if (options.actions?.length) {
    const primary = options.actions.find(a => a.primary)
    const secondary = options.actions.find(a => !a.primary)
    if (primary) out.action = toButton(primary)
    if (secondary) out.cancel = toButton(secondary)
    delete out.actions
  }
  return out
}

function toButton(a: ToastAction) {
  return {
    label: a.label,
    onClick: () => {
      try { a.handler() } catch { /* swallow */ }
    },
  }
}

/** 兼容原 appStore.showToast 签名 */
export const toast = {
  show,
  success: (message: string, options: Omit<ToastOptions, 'category'> = {}) =>
    sonner.success(message, { duration: 3000, ...normalize(options) }),
  error: (message: string, options: Omit<ToastOptions, 'category'> = {}) =>
    sonner.error(message, { duration: 5000, ...normalize(options) }),
  warning: (message: string, options: Omit<ToastOptions, 'category'> = {}) =>
    sonner.warning(message, { duration: 4000, ...normalize(options) }),
  info: (message: string, options: Omit<ToastOptions, 'category'> = {}) =>
    sonner(message, { duration: 3000, ...normalize(options) }),
  loading: (message: string, options: Omit<ToastOptions, 'category'> = {}) =>
    sonner.loading(message, { duration: Infinity, ...normalize(options) }),

  /** Promise 模式 */
  promise: <T,>(
    promise: Promise<T> | (() => Promise<T>),
    messages: { loading: string; success: string; error: string },
    options: ToastOptions = {},
  ): Promise<T> => {
    const p = typeof promise === 'function' ? promise() : promise
    sonner.promise(p, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
      // 让 success / error 复用传入的样式
      ...(options.description ? { description: options.description } : {}),
    })
    return p
  },

  /** 关闭 */
  dismiss: (id?: string | number) => sonner.dismiss(id),
  /** 全部关闭 */
  clear: () => sonner.dismiss(),

  /** 暴露底层对象，便于 JSX 自定义 */
  raw: sonner,
}
