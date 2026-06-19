import { describe, it, expect } from 'vitest';
import { DEFAULT_PROMPTS } from '@/utils/prompts';

describe('DEFAULT_PROMPTS', () => {
  it('contains all 4 default prompts', () => {
    expect(DEFAULT_PROMPTS).toHaveLength(4);
  });

  it('each prompt has id, name, and prompt fields', () => {
    for (const p of DEFAULT_PROMPTS) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('prompt');
    }
  });

  it('all strings are non-empty', () => {
    for (const p of DEFAULT_PROMPTS) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.prompt.length).toBeGreaterThan(0);
    }
  });

  it('has the expected prompt ids', () => {
    const ids = DEFAULT_PROMPTS.map(p => p.id);
    expect(ids).toContain('summarize');
    expect(ids).toContain('explain');
    expect(ids).toContain('takeaways');
    expect(ids).toContain('action-items');
  });
});
