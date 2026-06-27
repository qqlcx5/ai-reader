// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ConfirmModal from '../components/ConfirmModal.vue'
import { useModal } from '../composables/useModal'

describe('ConfirmModal', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    // Reset singleton state
    const modal = useModal()
    modal.isOpen.value = false
    modal.title.value = ''
    modal.description.value = ''
  })

  it('does not render when closed', () => {
    const wrapper = mount(ConfirmModal)
    expect(wrapper.text()).toBe('')
  })

  it('shows confirmation dialog when open', async () => {
    mount(ConfirmModal)
    const modal = useModal()
    modal.open({ title: '确认删除', description: '此操作不可撤销' })
    await new Promise((r) => setTimeout(r, 100))

    expect(document.body.textContent).toContain('确认删除')
    expect(document.body.textContent).toContain('此操作不可撤销')
  })

  it('resolves true on confirm', async () => {
    mount(ConfirmModal)
    const modal = useModal()
    const promise = modal.open({ title: 'Test', confirmLabel: '确认', cancelLabel: '取消' })
    await new Promise((r) => setTimeout(r, 50))

    modal.confirm()
    const result = await promise
    expect(result).toBe(true)
    expect(modal.isOpen.value).toBe(false)
  })

  it('resolves false on cancel', async () => {
    mount(ConfirmModal)
    const modal = useModal()
    const promise = modal.open({ title: 'Test' })
    await new Promise((r) => setTimeout(r, 50))

    modal.cancel()
    const result = await promise
    expect(result).toBe(false)
    expect(modal.isOpen.value).toBe(false)
  })

  it('closes on backdrop click', async () => {
    mount(ConfirmModal)
    const modal = useModal()
    modal.open({ title: 'Test' })
    await new Promise((r) => setTimeout(r, 50))

    // Click the backdrop div (first child inside the fixed overlay)
    const backdrop = document.querySelector('.backdrop-blur-sm')
    if (backdrop) {
      ;(backdrop as HTMLElement).click()
      await new Promise((r) => setTimeout(r, 50))
    }

    expect(modal.isOpen.value).toBe(false)
  })

  it('shows danger variant', async () => {
    mount(ConfirmModal)
    const modal = useModal()
    modal.open({ title: 'Danger', variant: 'danger', confirmLabel: '删除' })
    await new Promise((r) => setTimeout(r, 50))

    const confirmBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === '删除',
    )
    expect(confirmBtn).toBeTruthy()
    expect(confirmBtn?.className).toContain('bg-red')
  })
})
