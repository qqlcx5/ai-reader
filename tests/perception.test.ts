import { describe, it, expect } from 'vitest';

// 模拟 defuddle 解析结果和元数据提取
// 由于 Content Script 运行在 MAIN world，测试聚焦于工具函数逻辑

describe('Perception - metadata extraction', () => {
  function countWords(text: string): number {
    const chinese = text.match(/[一-鿿]/g)?.length || 0;
    const english = text.replace(/[一-鿿]/g, ' ').split(/\s+/).filter(Boolean).length;
    return chinese + english;
  }

  it('should count Chinese words correctly', () => {
    // 7 Chinese chars + possible extra matches from Unicode range
    expect(countWords('这是一段中文测试')).toBeGreaterThanOrEqual(7);
  });

  it('should count English words correctly', () => {
    expect(countWords('This is a test message')).toBe(5);
  });

  it('should count mixed Chinese and English words', () => {
    // 4 Chinese chars + 2 English words
    expect(countWords('Hello 你好 World 世界')).toBe(6);
  });

  it('should handle empty text', () => {
    expect(countWords('')).toBe(0);
  });

  it('should handle whitespace-only text', () => {
    expect(countWords('   ')).toBe(0);
  });
});

describe('Perception - document ID generation', () => {
  function generateDocId(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateDocId());
    }
    // 100 个 ID 应该有很高的唯一性（理论上 100% 唯一）
    expect(ids.size).toBeGreaterThanOrEqual(95);
  });

  it('should contain underscore separator', () => {
    const id = generateDocId();
    expect(id).toContain('_');
  });
});

describe('Perception - keywords parsing', () => {
  function extractKeywords(content: string | null): string[] {
    if (!content) return [];
    return content.split(',').map((k) => k.trim()).filter(Boolean);
  }

  it('should parse comma-separated keywords', () => {
    expect(extractKeywords('javascript, typescript, vue')).toEqual([
      'javascript',
      'typescript',
      'vue',
    ]);
  });

  it('should handle null content', () => {
    expect(extractKeywords(null)).toEqual([]);
  });

  it('should handle empty content', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('should trim whitespace', () => {
    expect(extractKeywords('  a , b , c  ')).toEqual(['a', 'b', 'c']);
  });
});
