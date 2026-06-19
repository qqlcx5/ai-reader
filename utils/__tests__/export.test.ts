import { describe, it, expect, vi } from 'vitest';
import { toMarkdown, toObsidianUri, toNotion } from '@/utils/export';

const sampleSummaries = [
  { providerId: 'openai', modelId: 'gpt-4o', text: 'This is a summary from GPT.' },
  { providerId: 'anthropic', modelId: 'claude-3', text: 'This is a summary from Claude.' },
];

describe('toMarkdown', () => {
  it('includes title', () => {
    const md = toMarkdown('Test Title', 'https://example.com', sampleSummaries);
    expect(md).toContain('# Test Title');
  });

  it('includes url', () => {
    const md = toMarkdown('Test Title', 'https://example.com', sampleSummaries);
    expect(md).toContain('https://example.com');
  });

  it('includes all summaries', () => {
    const md = toMarkdown('Test Title', 'https://example.com', sampleSummaries);
    expect(md).toContain('This is a summary from GPT.');
    expect(md).toContain('This is a summary from Claude.');
    expect(md).toContain('openai (gpt-4o)');
    expect(md).toContain('anthropic (claude-3)');
  });
});

describe('toObsidianUri', () => {
  it('returns obsidian:// URI for short content', () => {
    const uri = toObsidianUri('Short Title', [{ providerId: 'p', modelId: 'm', text: 'short' }]);
    expect(uri).toMatch(/^obsidian:\/\/new\?/);
    expect(uri).toContain('name=Short+Title');
  });

  it('returns clipboard: prefix for long content (>4000 chars)', () => {
    const longText = 'x'.repeat(4001);
    const uri = toObsidianUri('Long Title', [{ providerId: 'p', modelId: 'm', text: longText }]);
    expect(uri).toMatch(/^clipboard:/);
  });
});

describe('toNotion', () => {
  it('writes markdown to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeTextMock);

    await toNotion('Notion Title', sampleSummaries);
    expect(writeTextMock).toHaveBeenCalledOnce();
    const written = writeTextMock.mock.calls[0][0];
    expect(written).toContain('# Notion Title');
    expect(written).toContain('This is a summary from GPT.');
    expect(written).toContain('This is a summary from Claude.');
  });
});
