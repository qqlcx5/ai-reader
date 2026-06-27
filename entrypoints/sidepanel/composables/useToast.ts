import { ref } from 'vue'
import type { ToastState } from '@/shared/domain'

const toasts = ref<(ToastState & { id: number })[]>([])
let nextId = 0

export function useToast() {
  function addToast(type: ToastState['type'], title: string, description = '', duration = 3000) {
    const id = nextId++
    toasts.value.push({ id, type, title, description, duration })
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }

  function removeToast(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function showSuccess(title: string, description = '') {
    addToast('success', title, description)
  }

  function showError(title: string, description = '') {
    addToast('error', title, description)
  }

  function showInfo(title: string, description = '') {
    addToast('info', title, description)
  }

  return { toasts, showSuccess, showError, showInfo, removeToast }
}
