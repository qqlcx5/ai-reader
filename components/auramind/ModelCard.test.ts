import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ModelCard from './ModelCard.vue'
import type { ModelConfig } from '@/types/model'
import { useModelStore } from '@/stores/model.store'

vi.mock('@lucide/vue', () => ({
  Settings: { name: 'Settings', template: '<span class="mock-settings" />', props: ['class', 'size'] },
  Trash2: { name: 'Trash2', template: '<span class="mock-trash" />', props: ['class', 'size'] },
  Cpu: { name: 'Cpu', template: '<span class="mock-cpu" />', props: ['class', 'size'] },
  Bot: { name: 'Bot', template: '<span class="mock-bot" />', props: ['class', 'size'] },
  Box: { name: 'Box', template: '<span class="mock-box" />', props: ['class', 'size'] },
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
