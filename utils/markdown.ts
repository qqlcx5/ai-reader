import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

export function renderMarkdown(text: string): string {
  if (!text) return '';
  // Check if content looks like markdown (has markdown syntax)
  const hasMarkdownSyntax = /^#|^(\*|-|\d+\.)\s|^\*\*|^>|```|\[.+\]\(.+\)/m.test(text);
  if (hasMarkdownSyntax) {
    return DOMPurify.sanitize(md.render(text));
  }
  // Otherwise treat as HTML and sanitize
  return DOMPurify.sanitize(text);
}
