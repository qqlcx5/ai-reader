// ============================================================
// ExportPanel.test.ts — ExportPanel component tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ExportPanel from '@/components/views/ExportPanel.vue';
import { setLocale } from '@/core/export/i18n';

// Mock the clipboard API
const mockWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

// Mock URL.createObjectURL / revokeObjectURL
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
globalThis.URL.revokeObjectURL = vi.fn();

function makeArticle() {
  return {
    id: 'art-exp',
    title: 'Export Test Article',
    url: 'https://example.com/export-test',
    siteName: 'Test Site',
    author: 'Author',
    publishedAt: '2026-06-20',
    excerpt: 'An article for export testing.',
    markdown: '## Section 1\n\nContent here.',
    contentHtml: '',
    contentText: 'Section 1\nContent here.',
    faviconUrl: '',
    image: '',
    readingTime: 3,
    createdAt: '2026-06-27T12:00:00Z',
    updatedAt: '2026-06-27T12:00:00Z',
  };
}

describe('ExportPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setLocale('zh-CN');
    mockWriteText.mockReset();
  });

  it('renders the export title', () => {
    const wrapper = mount(ExportPanel, {
      props: { article: makeArticle() },
    });
    expect(wrapper.text()).toContain('导出文章');
  });

  it('renders format selector buttons', () => {
    const wrapper = mount(ExportPanel, {
      props: { article: makeArticle() },
    });
    expect(wrapper.text()).toContain('Obsidian Markdown');
    expect(wrapper.text()).toContain('MDX');
    expect(wrapper.text()).toContain('JSON');
  });

  it('renders variant selector in obsidian mode', () => {
    const wrapper = mount(ExportPanel, {
      props: { article: makeArticle() },
    });
    expect(wrapper.text()).toContain('标准导出');
    expect(wrapper.text()).toContain('开发者增强');
    expect(wrapper.text()).toContain('商务模板');
  });

  it('shows preview content', () => {
    const wrapper = mount(ExportPanel, {
      props: { article: makeArticle() },
    });
    // Preview should contain the frontmatter and content
    const pre = wrapper.find('pre');
    expect(pre.exists()).toBe(true);
    expect(pre.text()).toContain('Export Test Article');
  });

  it('shows empty state when no article', () => {
    const wrapper = mount(ExportPanel, {
      props: { article: null },
    });
    expect(wrapper.text()).toContain('没有可导出的文章');
  });

  it('shows download and copy buttons', () => {
    const wrapper = mount(ExportPanel, {
      props: { article: makeArticle() },
    });
    expect(wrapper.text()).toContain('下载文件');
    expect(wrapper.text()).toContain('复制内容');
  });

  it('shows batch export button in batch mode', () => {
    const articles = [makeArticle(), { ...makeArticle(), id: 'art-exp-2', title: 'Second' }];
    const wrapper = mount(ExportPanel, {
      props: { article: makeArticle(), batchMode: true, articles },
    });
    expect(wrapper.text()).toContain('导出全部');
    expect(wrapper.text()).toContain('2 篇');
  });

  it('emits close event when close button clicked', async () => {
    const wrapper = mount(ExportPanel, {
      props: { article: makeArticle() },
    });
    // Find close button (the X icon button)
    const closeBtn = wrapper.find('button');
    await closeBtn.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('generates correct content for default + obsidian', () => {
    const wrapper = mount(ExportPanel, {
      props: { article: makeArticle() },
    });
    const pre = wrapper.find('pre');
    const content = pre.text();
    expect(content).toContain('title: "Export Test Article"');
    expect(content).toContain('source: "https://example.com/export-test"');
    expect(content).toContain('## Section 1');
  });
});
