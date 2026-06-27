// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ChatView from '../views/ChatView.vue';

describe('ChatView — Component Structure', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  function createWrapper() {
    return mount(ChatView, {
      global: {
        stubs: {
          AppCard: { template: '<div class="app-card"><slot /></div>' },
          StreamingMessage: {
            template: '<div class="streaming-msg">{{ content }}</div>',
            props: ['content', 'isStreaming'],
          },
          MessageCircle: { template: '<svg />' },
          Zap: { template: '<svg />' },
          StopCircle: { template: '<svg />' },
          Copy: { template: '<svg />' },
          Trash2: { template: '<svg />' },
          Brain: { template: '<svg />' },
          Sparkles: { template: '<svg />' },
          ListChecks: { template: '<svg />' },
          Tags: { template: '<svg />' },
          Bot: { template: '<svg />' },
          User: { template: '<svg />' },
          AlertCircle: { template: '<svg />' },
          ChevronDown: { template: '<svg />' },
        },
      },
    });
  }

  it('renders the provider selector button', () => {
    const wrapper = createWrapper();
    expect(wrapper.html()).toContain('选择模型');
  });

  it('renders the workflow selector', () => {
    const wrapper = createWrapper();
    expect(wrapper.html()).toContain('TL;DR');
  });

  it('renders the "Run AI Analysis" button initially', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('一键运行 AI 分析');
  });

  it('renders the empty state when no messages', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('AI 文章消化');
  });

  it('renders the input box and send button', () => {
    const wrapper = createWrapper();
    expect(wrapper.find('input').exists()).toBe(true);
    expect(wrapper.find('button').exists()).toBe(true);
  });

  it('renders status indicator', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('就绪');
  });
});
