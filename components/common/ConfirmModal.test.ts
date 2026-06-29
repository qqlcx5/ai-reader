import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmModal from './ConfirmModal.vue'

// ConfirmModal portals to document.body, so query there (not wrapper.findAll).
function findButton(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text),
  )
}

describe('ConfirmModal', () => {
  it('emits confirm when the action button is clicked', async () => {
    const wrapper = mount(ConfirmModal, {
      props: { title: '删除', desc: '确定？' },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    const confirm = findButton('确认')
    expect(confirm).toBeTruthy()
    confirm!.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('confirm')).toBeTruthy()
    wrapper.unmount()
  })

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mount(ConfirmModal, {
      props: { title: '删除', desc: '确定？' },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    const cancel = findButton('取消')
    expect(cancel).toBeTruthy()
    cancel!.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })
})
