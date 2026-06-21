import { describe, expect, it, vi } from 'vitest';
import {
  buildObsidianUri,
  buildSafeObsidianUri,
  byteLength,
  downloadAsMarkdown,
  OBSIDIAN_URI_SAFE_BYTES,
  PayloadTooLargeError,
  sanitizeFileName,
} from '@/lib/export';

describe('obsidian', () => {
  describe('buildObsidianUri', () => {
    it('builds a basic obsidian://new URI with vault, file, and content', () => {
      const uri = buildObsidianUri('Note', 'Hello', { vault: 'Personal' });
      expect(uri).toMatch(/^obsidian:\/\/new\?/);
      const params = new URLSearchParams(uri.split('?')[1]);
      expect(params.get('vault')).toBe('Personal');
      expect(params.get('file')).toBe('Note.md');
      expect(params.get('content')).toBe('Hello');
    });

    it('prepends a folder when provided', () => {
      const uri = buildObsidianUri('Hi', 'Body', {
        vault: 'V',
        folder: 'inbox/notes',
      });
      const params = new URLSearchParams(uri.split('?')[1]);
      expect(params.get('file')).toBe('inbox/notes/Hi.md');
    });

    it('trims leading/trailing slashes in the folder', () => {
      const uri = buildObsidianUri('Hi', 'Body', {
        vault: 'V',
        folder: '/nested/dir/',
      });
      const params = new URLSearchParams(uri.split('?')[1]);
      expect(params.get('file')).toBe('nested/dir/Hi.md');
    });

    it('encodes the content for safe transport', () => {
      const uri = buildObsidianUri('T', 'hello world & friends', { vault: 'V' });
      const params = new URLSearchParams(uri.split('?')[1]);
      expect(params.get('content')).toBe('hello world & friends');
    });
  });

  describe('buildSafeObsidianUri', () => {
    it('returns the URI when under the safe byte limit', () => {
      const uri = buildSafeObsidianUri('Short', 'small body', { vault: 'V' });
      expect(byteLength(uri)).toBeLessThanOrEqual(OBSIDIAN_URI_SAFE_BYTES);
    });

    it('throws PayloadTooLargeError when the encoded URI exceeds the cap', () => {
      const huge = 'x'.repeat(OBSIDIAN_URI_SAFE_BYTES);
      expect(() =>
        buildSafeObsidianUri('Huge', huge, { vault: 'V' }),
      ).toThrow(PayloadTooLargeError);
    });
  });

  describe('sanitizeFileName', () => {
    it('strips path separators and control chars', () => {
      expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
    });

    it('collapses whitespace and trims', () => {
      expect(sanitizeFileName('  hello   world  ')).toBe('hello world');
    });

    it('returns "untitled" for empty input', () => {
      expect(sanitizeFileName('')).toBe('untitled');
      expect(sanitizeFileName('   ')).toBe('untitled');
    });

    it('truncates very long names', () => {
      const long = 'a'.repeat(500);
      expect(sanitizeFileName(long).length).toBeLessThanOrEqual(200);
    });
  });

  describe('downloadAsMarkdown', () => {
    it('creates an anchor and triggers a download', () => {
      const click = vi.fn();
      const originalCreate = document.createElement.bind(document);
      const createSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        const el = originalCreate(tag) as HTMLAnchorElement;
        if (tag === 'a') {
          el.click = click as unknown as HTMLAnchorElement['click'];
        }
        return el as unknown as HTMLElement;
      }) as typeof document.createElement);

      downloadAsMarkdown('note', '# hi');

      expect(createSpy).toHaveBeenCalledWith('a');
      expect(click).toHaveBeenCalled();

      createSpy.mockRestore();
    });

    it('appends .md extension if missing', () => {
      const originalCreate = document.createElement.bind(document);
      let anchorName: string | undefined;
      vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        const el = originalCreate(tag) as HTMLAnchorElement;
        if (tag === 'a') {
          Object.defineProperty(el, 'download', {
            set(v: string) {
              anchorName = v;
            },
            get() {
              return anchorName ?? '';
            },
          });
        }
        return el as unknown as HTMLElement;
      }) as typeof document.createElement);

      downloadAsMarkdown('raw', '# hi');
      expect(anchorName).toBe('raw.md');

      vi.restoreAllMocks();
    });
  });
});
