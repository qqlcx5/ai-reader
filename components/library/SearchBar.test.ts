import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchBar from './SearchBar.vue'

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders with initial modelValue', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: 'hello' },
    })
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('hello')
  })

  it('emits update:modelValue immediately on input', async () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '' },
    })
    const input = wrapper.find('input')
    await input.setValue('test')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['test'])
  })

  it('emits search after 300ms debounce', async () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '' },
    })
    const input = wrapper.find('input')
    await input.setValue('query')

    // search should not emit immediately
    expect(wrapper.emitted('search')).toBeUndefined()

    // Fast-forward 300ms
    vi.advanceTimersByTime(300)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('search')).toBeTruthy()
    expect(wrapper.emitted('search')![0]).toEqual(['query'])
  })

  it('shows recent docs when search query is empty', async () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '' },
    })
    const input = wrapper.find('input')
    await input.setValue('some')
    vi.advanceTimersByTime(300)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('search')).toBeTruthy()

    // Clear
    await input.setValue('')
    vi.advanceTimersByTime(300)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('search')!.at(-1)).toEqual([''])
  })

  it('debounce resets on rapid input', async () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '' },
    })
    const input = wrapper.find('input')
    await input.setValue('a')
    vi.advanceTimersByTime(200)
    await input.setValue('ab')
    vi.advanceTimersByTime(200)
    await input.setValue('abc')
    vi.advanceTimersByTime(300)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('search')!.length).toBe(1)
    expect(wrapper.emitted('search')![0]).toEqual(['abc'])
  })
})
