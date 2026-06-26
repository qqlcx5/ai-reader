// ============================================================
// PageMind — Toast Composable (provide/inject pattern)
// ============================================================

import { ref, provide, inject, type InjectionKey, type Ref } from 'vue'
import { useSettingsStore } from '@/stores/settings.store'
import type { ToastType } from '@/domain'

// ---- Types ----

export interface ToastContext {
  /** Current toast state (null when no toast is showing). */
  toast: Ref<ToastType | null>
  /** Show a toast notification. Respects settings.showToast. */
  showToast: (type: 'success' | 'error' | 'info', title: string, desc?: string, duration?: number) => void
}

// ---- Injection Key ----

const TOAST_KEY: InjectionKey<ToastContext> = Symbol('toast')

// ---- Provide (call once in App.vue setup) ----

export function provideToast(): ToastContext {
  const settingsStore = useSettingsStore()
  const toast = ref<ToastType | null>(null)

  function showToast(
    type: 'success' | 'error' | 'info',
    title: string,
    desc?: string,
    duration?: number,
  ): void {
    // Respect showToast setting — suppress all toasts when disabled
    if (!settingsStore.settings.showToast) return

    // Replace strategy: new toast immediately replaces the current one
    toast.value = { type, title, description: desc, duration: duration ?? 2200 }
  }

  const ctx: ToastContext = { toast, showToast }
  provide(TOAST_KEY, ctx)
  return ctx
}

// ---- Inject (use in child components for direct toast control) ----

export function useToast(): ToastContext {
  const ctx = inject(TOAST_KEY)
  if (!ctx) {
    throw new Error('useToast() must be used within a component that calls provideToast() in an ancestor')
  }
  return ctx
}
