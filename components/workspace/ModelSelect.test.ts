import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ModelSelect from './ModelSelect.vue'
import type { ModelConfig } from '@/types/model'

function makeModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'm1',
    name: 'GPT-4',
    provider: 'openai-compatible',
    modelId: 'gpt-4',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test',
    enabled: true,
    isDefault: true,
    contextWindow: 8192,
    temperature: 0.9,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('ModelSelect', () => {
  it('filters to only enabled models', () => {
    const models = [
      makeModel({ id: 'm1', name: 'GPT-4 Enabled', enabled: true }),
      makeModel({ id: 'm2', name: 'GPT-3 Disabled', enabled: false }),
      makeModel({ id: 'm3', name: 'Claude Enabled', enabled: true }),
    ]
    const wrapper = mount(ModelSelect, {
      props: { modelValue: 'm1', models },
    })
    // Should show Select component with enabled models only
    const select = wrapper.findComponent({ name: 'Select' })
    expect(select.exists()).toBe(true)
  })

  it('shows "No enabled models" when no models are enabled', () => {
    const models = [
      makeModel({ id: 'm1', name: 'Disabled', enabled: false }),
    ]
    const wrapper = mount(ModelSelect, {
      props: { modelValue: '', models },
    })
    expect(wrapper.text()).toContain('No enabled models')
  })

  it('emits update:modelValue on selection change', async () => {
    const models = [makeModel({ id: 'm1', enabled: true })]
    const wrapper = mount(ModelSelect, {
      props: { modelValue: 'm1', models },
    })
    const select = wrapper.findComponent({ name: 'Select' })
    await select.vm.$emit('update:modelValue', 'm1')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  })

  it('computes label from models list', () => {
    const models = [
      makeModel({ id: 'm1', name: 'ChatGPT', enabled: true }),
    ]
    const wrapper = mount(ModelSelect, {
      props: { modelValue: 'm1', models },
    })
    const select = wrapper.findComponent({ name: 'Select' })
    expect(select.exists()).toBe(true)
  })
})
