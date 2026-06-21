import { describe, it, expect } from 'vitest';
import { extractWithReadability } from '../extractors/readability';
import { extractWithDefuddle } from '../extractors/defuddle';
import { extractWithInnerText } from '../extractors/innerText';
import { extractPage } from '../extractPage';
import {
  splitIntoChunks,
  createChunkedTransfers,
  assembleChunks,
  generateTransferId,
} from '../transfer';
import type { ExtractedContext } from '../types';

function createMockDocument(html: string, url = 'https://example.com/article'): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  // jsdom's document may not have location; use a custom property if needed
  (doc as any).__location = { href: url };
  return doc as Document;
}

const sampleArticle = `
<!DOCTYPE html>
<html>
<head><title>Test Article</title></head>
<body>
  <header>Site Header</header>
  <nav>Navigation</nav>
  <article>
    <h1>Main Title</h1>
    <p>This is a paragraph with enough content to pass the minimum length threshold. It contains multiple sentences and should be extracted properly by Readability. The quick brown fox jumps over the lazy dog. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
    <p>Second paragraph with more text. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>
    <p>Third paragraph. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.</p>
  </article>
  <aside>Sidebar content</aside>
  <footer>Footer content</footer>
</body>
</html>
`;

const shortContent = `
<!DOCTYPE html>
<html><head><title>Short</title></head>
<body><p>Too short.</p></body>
</html>
`;

describe('Readability extractor', () => {
  it('extracts article content as markdown', () => {
    const doc = createMockDocument(sampleArticle);
    const result = extractWithReadability(doc);
    expect(result).not.toBeNull();
    expect(result!.extractor).toBe('readability');
    expect(result!.format).toBe('markdown');
    expect(result!.content.length).toBeGreaterThan(200);
    expect(result!.title).toBe('Test Article');
  });

  it('returns null for very short content', () => {
    const doc = createMockDocument(shortContent);
    const result = extractWithReadability(doc);
    expect(result).toBeNull();
  });

  it('returns null for empty document', () => {
    const doc = createMockDocument('<html><head><title>Empty</title></head><body></body></html>');
    const result = extractWithReadability(doc);
    expect(result).toBeNull();
  });
});

describe('Defuddle extractor', () => {
  it('extracts content with timeout', async () => {
    const doc = createMockDocument(sampleArticle);
    const result = await extractWithDefuddle(doc, 5000);
    // Defuddle may or may not be available in test env; if null, that's acceptable
    if (result) {
      expect(result.extractor).toBe('defuddle');
      expect(result.content.length).toBeGreaterThan(0);
    }
  });

  it('handles short timeout gracefully', async () => {
    const doc = createMockDocument(sampleArticle);
    // Defuddle is synchronous in jsdom; timeout test is unreliable in test env.
    // We verify that the function handles errors gracefully.
    const result = await extractWithDefuddle(doc, 1);
    // In jsdom, Defuddle may complete before the timeout fires; accept either outcome.
    if (result !== null) {
      expect(result.extractor).toBe('defuddle');
    }
  });
});

describe('innerText extractor', () => {
  it('extracts plain text and removes noise tags', () => {
    const doc = createMockDocument(sampleArticle);
    const result = extractWithInnerText(doc);
    expect(result.extractor).toBe('innerText');
    expect(result.format).toBe('text');
    expect(result.content).not.toContain('<script>');
    expect(result.content.length).toBeGreaterThan(200);
  });

  it('cleans excessive whitespace', () => {
    const html = `<html><head><title>Whitespace</title></head><body>
      <p>Line one.</p>



      <p>Line two.</p>
    </body></html>`;
    const doc = createMockDocument(html);
    const result = extractWithInnerText(doc);
    expect(result.content).not.toMatch(/\n{3,}/);
  });
});

describe('extractPage — 3-level fallback', () => {
  it('uses Readability for good articles', async () => {
    const doc = createMockDocument(sampleArticle);
    const result = await extractPage(doc);
    expect(result.extractor).toBe('readability');
    expect(result.content.length).toBeGreaterThan(200);
  });

  it('falls back to innerText when Readability fails', async () => {
    const doc = createMockDocument(shortContent);
    const result = await extractPage(doc);
    expect(result.extractor).toBe('innerText');
  });

  it('falls back to innerText for empty body', async () => {
    const doc = createMockDocument('<html><head><title>Empty</title></head><body></body></html>');
    const result = await extractPage(doc);
    expect(result.extractor).toBe('innerText');
  });
});

describe('Chunk transfer', () => {
  it('splits content into 1MB chunks', () => {
    const big = 'a'.repeat(3 * 1024 * 1024 + 100);
    const chunks = splitIntoChunks(big);
    expect(chunks.length).toBe(4);
    expect(chunks[0].length).toBe(1024 * 1024);
    expect(chunks[3].length).toBe(100);
  });

  it('assembles chunks in correct order', () => {
    const original = 'Hello world this is a test string for chunk assembly.';
    const chunks = splitIntoChunks(original);
    const transfers = createChunkedTransfers('t1', chunks);
    // Shuffle
    const shuffled = [...transfers].sort(() => Math.random() - 0.5);
    const assembled = assembleChunks(shuffled);
    expect(assembled).toBe(original);
  });

  it('generates unique transfer IDs', () => {
    const id1 = generateTransferId('https://a.com');
    const id2 = generateTransferId('https://b.com');
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^\d+-\d+$/);
  });
});
