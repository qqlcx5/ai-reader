import { describe, it, expect, vi } from 'vitest';
import { toMarkdown, toObsidianUri, toNotion, toCsv } from '@/utils/export';

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

describe('toCsv', () => {
  const sampleRows = [
    {
      title: 'Test Article',
      url: 'https://example.com',
      timestamp: '2024-01-01T00:00:00Z',
      prompt: 'Summarize this',
      providerId: 'openai',
      modelId: 'gpt-4o',
      responseText: 'This is the response.',
      inputTokens: 100,
      outputTokens: 50,
      estimatedCost: 0.001,
      elapsedMs: 2000,
      status: 'done',
    },
  ];

  it('generates valid CSV with header', () => {
    const csv = toCsv(sampleRows);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Title');
    expect(lines[0]).toContain('Provider');
    expect(lines[0]).toContain('Model');
    expect(lines[0]).toContain('Status');
  });

  it('includes data rows', () => {
    const csv = toCsv(sampleRows);
    expect(csv).toContain('Test Article');
    expect(csv).toContain('openai');
    expect(csv).toContain('gpt-4o');
    expect(csv).toContain('done');
  });

  it('escapes fields with commas', () => {
    const rows = [{ ...sampleRows[0], title: 'Title, with comma' }];
    const csv = toCsv(rows);
    expect(csv).toContain('"Title, with comma"');
  });

  it('escapes fields with quotes', () => {
    const rows = [{ ...sampleRows[0], title: 'Title "quoted"' }];
    const csv = toCsv(rows);
    expect(csv).toContain('"Title ""quoted"""');
  });
});
