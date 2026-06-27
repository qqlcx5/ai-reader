// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useCaptureStore } from '../../../stores/capture'
import ExtractPipeline from '../views/ExtractPipeline.vue'

function createWrapper() {
  return mount(ExtractPipeline, {
    global: {
      stubs: { TransitionGroup: false },
    },
  })
}

describe('ExtractPipeline', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renders nothing when idle', () => {
    const store = useCaptureStore()
    store.reset()
    const wrapper = createWrapper()
    expect(wrapper.text()).toBe('')
  })

  it('shows extracting as active', () => {
    const store = useCaptureStore()
    store.setStep('extracting')
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('提取内容')
    expect(wrapper.text()).toContain('转换格式')
    expect(wrapper.text()).toContain('保存文章')
    const activeEls = wrapper.findAll('.bg-blue')
    expect(activeEls.length).toBeGreaterThan(0)
  })

  it('shows all steps as done on success', () => {
    const store = useCaptureStore()
    store.setStep('success')
    const wrapper = createWrapper()
    const doneEls = wrapper.findAll('.bg-green-100')
    expect(doneEls.length).toBe(3)
  })

  it('shows error step as error', () => {
    const store = useCaptureStore()
    store.setStep('extracting')
    store.setError('EXTRACTION_FAILED')
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('EXTRACTION_FAILED')
    const errorEls = wrapper.findAll('.bg-red-100')
    expect(errorEls.length).toBeGreaterThan(0)
  })

  it('has correct step order: done steps are green', () => {
    const store = useCaptureStore()
    store.setStep('markdown')
    const wrapper = createWrapper()
    // 'extracting' should be done (green), 'markdown' active (blue), 'saving' idle (gray)
    const doneEls = wrapper.findAll('.bg-green-100')
    const activeEls = wrapper.findAll('.bg-blue')
    const idleEls = wrapper.findAll('.bg-gray-100')
    expect(doneEls.length).toBe(1)
    expect(activeEls.length).toBe(1)
    expect(idleEls.length).toBe(1)
  })
})
