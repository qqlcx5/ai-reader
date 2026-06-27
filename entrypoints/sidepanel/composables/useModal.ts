import { ref } from 'vue'

const isOpen = ref(false)
const title = ref('')
const description = ref('')
const confirmLabel = ref('确认')
const cancelLabel = ref('取消')
const variant = ref<'danger' | 'default'>('default')
let resolvePromise: ((value: boolean) => void) | null = null

export function useModal() {
  function open(options: {
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'danger' | 'default'
  }): Promise<boolean> {
    title.value = options.title
    description.value = options.description ?? ''
    confirmLabel.value = options.confirmLabel ?? '确认'
    cancelLabel.value = options.cancelLabel ?? '取消'
    variant.value = options.variant ?? 'default'
    isOpen.value = true

    return new Promise((resolve) => {
      resolvePromise = resolve
    })
  }

  function confirm() {
    isOpen.value = false
    resolvePromise?.(true)
    resolvePromise = null
  }

  function cancel() {
    isOpen.value = false
    resolvePromise?.(false)
    resolvePromise = null
  }

  return { isOpen, title, description, confirmLabel, cancelLabel, variant, open, confirm, cancel }
}
