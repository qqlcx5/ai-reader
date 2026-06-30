import { onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app.store'

/**
 * Wire up "go back" input methods to the app view history:
 *  - mouse back button (side button, `button === 3`)
 *  - Alt+Left and Escape (skipped while typing in an input)
 *
 * Must be called from a component setup() — registers window listeners on
 * mount and tears them down on unmount. Capture phase so we intercept before
 * the browser's own back-navigation default.
 */
export function useBackNavigation(): void {
  const appStore = useAppStore()

  function isEditableTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    if (!el) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button === 3 && appStore.canGoBack) {
      e.preventDefault()
      appStore.goBack()
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!appStore.canGoBack) return
    if (isEditableTarget(e.target)) return
    if (e.key === 'Escape' || (e.altKey && e.key === 'ArrowLeft')) {
      e.preventDefault()
      appStore.goBack()
    }
  }

  onMounted(() => {
    window.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('keydown', onKeyDown, true)
  })

  onUnmounted(() => {
    window.removeEventListener('mousedown', onMouseDown, true)
    window.removeEventListener('keydown', onKeyDown, true)
  })
}
