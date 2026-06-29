import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ModelCard from './ModelCard.vue'
import type { ModelConfig } from '@/types/model'
import Switch from '@/components/ui/Switch.vue'

vi.mock('@lucide/vue', () => ({
  Settings: { name: 'Settings', template: '<span class="mock-settings" />', props: ['class', 'size'] },
  Trash2: { name: 'Trash2', template: '<span class="mock-trash" />', props: ['class', 'size'] },
  Cpu: { name: 'Cpu', template: '<span class="mock-cpu" />', props: ['class', 'size'] },
  Bot: { name: 'Bot', template: '<span class="mock-bot" />', props: ['class', 'size'] },
  Box: { name: 'Box', template: '<span class="mock-box" />', props: ['class', 'size'] },
  Copy: { name: 'Copy', template: '<span class="mock-copy" />', props: ['class', 'size'] },
  Activity: { name: 'Activity', template: '<span class="mock-activity" />', props: ['class', 'size'] },
}))

function makeModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'm1',
    name: 'GPT-4',
    provider: 'openai-compatible',
    modelId: 'gpt-4',
    baseUrl: 'https://api.openai.com/v1',
    enabled: true,
    isDefault: true,
    contextWindow: 128000,
    temperature: 0.9,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastTestStatus: 'success',
    lastTestLatency: 120,
    ...overrides,
  }
}

describe('ModelCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders model name and modelId', () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ name: 'Claude 3.5', modelId: 'claude-3-5-sonnet' }) },
    })

    expect(wrapper.text()).toContain('Claude 3.5')
    expect(wrapper.text()).toContain('claude-3-5-sonnet')
  })

  it('shows default badge when isDefault', () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ isDefault: true }) },
    })

    expect(wrapper.text()).toContain('默认')
  })

  it('does not show default badge when not default', () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ isDefault: false }) },
    })

    expect(wrapper.text()).not.toContain('默认')
  })

  it('shows truncated baseUrl', () => {
    const longUrl = 'https://very-long-api-endpoint.example.com/v1/chat/completions'
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ baseUrl: longUrl }) },
    })

    // The displayed URL should be truncated with '...'
    expect(wrapper.text()).toContain('...')
  })

  it('shows success status indicator', () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ lastTestStatus: 'success', lastTestLatency: 120 }) },
    })

    const indicator = wrapper.find('[title="通过 120ms"]')
    expect(indicator.exists()).toBe(true)
  })

  it('shows failed status indicator', () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ lastTestStatus: 'failed' }) },
    })

    const indicator = wrapper.find('[title="失败"]')
    expect(indicator.exists()).toBe(true)
  })

  it('shows untested status indicator', () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ lastTestStatus: 'untested' }) },
    })

    const indicator = wrapper.find('[title="未测试"]')
    expect(indicator.exists()).toBe(true)
  })

  it('emits edit when edit button clicked', async () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ id: 'm1' }) },
    })

    await wrapper.find('[title="编辑"]').trigger('click')
    expect(wrapper.emitted('edit')).toBeTruthy()
    expect(wrapper.emitted('edit')![0]).toEqual(['m1'])
  })

  it('emits delete when delete button clicked', async () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ id: 'm2' }) },
    })

    await wrapper.find('[title="删除"]').trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')![0]).toEqual(['m2'])
  })

  it('emits duplicate when copy button clicked', async () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ id: 'm3' }) },
    })

    await wrapper.find('[title="复制模型"]').trigger('click')
    expect(wrapper.emitted('duplicate')).toBeTruthy()
    expect(wrapper.emitted('duplicate')![0]).toEqual(['m3'])
  })

  it('emits toggleEnabled when switch value changes', async () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ id: 'm6', enabled: true }) },
    })

    wrapper.findComponent(Switch).vm.$emit('update:modelValue', false)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('toggleEnabled')).toBeTruthy()
    expect(wrapper.emitted('toggleEnabled')![0]).toEqual(['m6', false])
  })

  it('emits ping when ping button clicked', async () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ id: 'm4', lastTestStatus: 'untested' }) },
    })

    await wrapper.find('[title="Ping"]').trigger('click')
    expect(wrapper.emitted('ping')).toBeTruthy()
    expect(wrapper.emitted('ping')![0]).toEqual(['m4'])
  })

  it('does not emit ping while testing', async () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ id: 'm5', lastTestStatus: 'testing' }) },
    })

    await wrapper.find('[title="Ping"]').trigger('click')
    expect(wrapper.emitted('ping')).toBeFalsy()
  })

  it('renders provider label correctly for openai-compatible', () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ provider: 'openai-compatible' }) },
    })

    expect(wrapper.text()).toContain('OpenAI Compatible')
  })

  it('renders provider label correctly for anthropic', () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ provider: 'anthropic' }) },
    })

    expect(wrapper.text()).toContain('Anthropic')
  })

  it('renders provider label correctly for ollama', () => {
    const wrapper = mount(ModelCard, {
      props: { model: makeModel({ provider: 'ollama' }) },
    })

    expect(wrapper.text()).toContain('Ollama')
  })
})
