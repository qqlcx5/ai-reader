import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    const validLang = lang && hljs.getLanguage(lang);
    const highlighted = validLang
      ? hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
      : md.utils.escapeHtml(str);

    const langLabel = validLang ? `<span class="code-lang">${lang}</span>` : '';
    const copyBtn = `<button class="code-copy-btn" onclick="copyCodeBlock(this)" title="复制代码">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>`;

    return `<div class="code-block-wrapper">${langLabel}${copyBtn}<pre class="hljs"><code class="language-${lang || 'text'}">${highlighted}</code></pre></div>`;
  },
});

// Inject the copy function into the page scope
if (typeof window !== 'undefined') {
  (window as any).copyCodeBlock = function (btn: HTMLButtonElement) {
    const codeEl = btn.parentElement?.querySelector('code');
    if (!codeEl) return;
    const text = codeEl.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1500);
    });
  };
}

export function renderMarkdown(text: string): string {
  if (!text) return '';
  // Check if content looks like markdown
  const hasMarkdownSyntax = /^#|^(\*|-|\d+\.)\s|^\*\*|^>|```|\[.+\]\(.+\)/m.test(text);
  if (hasMarkdownSyntax) {
    return DOMPurify.sanitize(md.render(text), {
      ADD_TAGS: ['button', 'svg', 'rect', 'path', 'span', 'pre', 'code'],
      ADD_ATTR: ['onclick', 'class', 'title', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd', 'x', 'y', 'rx', 'ry'],
    });
  }
  // Otherwise treat as HTML and sanitize
  return DOMPurify.sanitize(text);
}
