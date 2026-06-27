// ============================================================
// i18n.test.ts — I18n translation unit tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale, getLocale } from '../i18n';

describe('i18n', () => {
  beforeEach(() => {
    setLocale('zh-CN');
  });

  describe('getLocale / setLocale', () => {
    it('defaults to zh-CN', () => {
      expect(getLocale()).toBe('zh-CN');
    });

    it('changes to a known locale', () => {
      setLocale('zh-CN');
      expect(getLocale()).toBe('zh-CN');
    });

    it('ignores unknown locale and keeps current', () => {
      setLocale('en-US');
      expect(getLocale()).toBe('zh-CN');
    });
  });

  describe('t()', () => {
    it('translates simple keys', () => {
      expect(t('export.title')).toBe('导出文章');
      expect(t('export.download')).toBe('下载文件');
      expect(t('export.copy')).toBe('复制内容');
    });

    it('translates nested format keys', () => {
      expect(t('export.format_obsidian')).toBe('Obsidian Markdown (.md)');
      expect(t('export.format_mdx')).toBe('思维脑图 MDX');
      expect(t('export.format_json')).toBe('JSON 脑图');
    });

    it('translates variant keys', () => {
      expect(t('export.variant_default')).toBe('标准导出');
      expect(t('export.variant_developer')).toBe('开发者增强');
      expect(t('export.variant_business')).toBe('商务模板');
    });

    it('handles interpolation with {{var}}', () => {
      const result = t('export.batch_export_all', { count: 5 });
      expect(result).toBe('导出全部 (5 篇)');
    });

    it('handles interpolation with different values', () => {
      const result = t('export.batch_export_all', { count: 42 });
      expect(result).toBe('导出全部 (42 篇)');
    });

    it('returns key itself for missing keys', () => {
      expect(t('nonexistent.key')).toBe('nonexistent.key');
    });

    it('returns key for missing nested path', () => {
      expect(t('export.nonexistent')).toBe('export.nonexistent');
    });

    it('translates mindmap keys', () => {
      expect(t('mindmap.title')).toBe('思维脑图');
      expect(t('mindmap.format_mdx')).toBe('MDX 格式');
      expect(t('mindmap.format_json')).toBe('JSON 格式');
    });

    it('translates obsidian field names', () => {
      expect(t('obsidian.fields.title')).toBe('标题');
      expect(t('obsidian.fields.source')).toBe('来源URL');
      expect(t('obsidian.fields.author')).toBe('作者');
    });

    it('translates common keys', () => {
      expect(t('common.cancel')).toBe('取消');
      expect(t('common.confirm')).toBe('确认');
    });
  });
});
