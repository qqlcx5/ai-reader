import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UFloatingBall from './UFloatingBall.vue'

describe('UFloatingBall', () => {
  it('is fully visible on first render (not tucked off-screen)', () => {
    const wrapper = mount(UFloatingBall, {
      props: { storageKey: 'test-ball-init', size: 44, hideInset: 14 },
      slots: { default: '<button data-floating-trigger>●</button>' },
    })
    const el = wrapper.element as HTMLElement
    // On the right edge, fully visible means right = base offset (12px),
    // NOT 12 - (44 - 14) = -18 (which would tuck it off-screen).
    expect(el.style.right).toBe('12px')
    expect(el.style.right).not.toBe('-18px')
  })

  it('renders the slotted trigger', () => {
    const wrapper = mount(UFloatingBall, {
      props: { storageKey: 'test-ball-slot' },
      slots: { default: '<button data-floating-trigger>x</button>' },
    })
    expect(wrapper.find('[data-floating-trigger]').exists()).toBe(true)
  })
})
