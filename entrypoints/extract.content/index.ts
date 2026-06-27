// ============================================================
// SuperBrain Extract Content Script – Dynamically Injected
// (Only loaded via chrome.scripting.executeScript when needed)
// ============================================================

import type { ExtractResult, PageMetadata } from '../../shared/domain';

export default defineContentScript({
  // Never auto-inject – only loaded via scripting.executeScript
  matches: ['*://__superbrain_internal_never_match__/*'],
  runAt: 'document_idle',
  main() {
    console.log('[SuperBrain] Extract script injected');

    // ---- Generation Counter sync ----
    (window as any).__pageMindGeneration =
      ((window as any).__pageMindGeneration ?? 0) + 1;
    const myGeneration: number = (window as any).__pageMindGeneration;

    browser.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
      if ((window as any).__pageMindGeneration !== myGeneration) {
        sendResponse({ error: 'STALE_SCRIPT' });
        return false;
      }

      if (message?.type === 'EXECUTE_EXTRACT') {
        runExtraction(sendResponse);
        return true;
      }

      return false;
    });
  },
});

// ============================================================
// Extraction Logic (runs in page context with defuddle)
// ============================================================

async function runExtraction(sendResponse: (resp: any) => void): Promise<void> {
  try {
    const url = window.location.href;

    // Dynamically import defuddle – only loaded during extraction
    const { default: Defuddle } = await import('defuddle');

    // Flatten shadow DOM
    flattenShadowDom(document);

    const defuddle = new Defuddle(document, { url });
    let raw: any;

    // 8s timeout with sync fallback
    try {
      raw = await Promise.race([
        defuddle.parseAsync(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000),
        ),
      ]);
    } catch {
      raw = defuddle.parse();
    }

    const extractResult = normalizeExtract(raw, url);
    const metadata = extractPageMetadata(document, url);
    const markdown = await buildMarkdown(extractResult, metadata, raw.content ?? raw.contentHtml ?? '');

    sendResponse({
      status: 'ok',
      data: { extractResult, metadata, markdown },
    });
  } catch (err: any) {
    console.error('[SuperBrain] Extract failed:', err?.message);
    sendResponse({ status: 'error', error: err?.message || String(err) });
  }
}

// ============================================================
// Utilities
// ============================================================

function flattenShadowDom(root: Document | Element): void {
  root.querySelectorAll('*').forEach((el: any) => {
    const shadow = el.shadowRoot || el.openOrClosedShadowRoot;
    if (!shadow) return;
    while (shadow.firstChild) el.appendChild(shadow.firstChild);
    flattenShadowDom(el);
  });
}

function normalizeExtract(raw: any, url: string): ExtractResult {
  const html = raw.contentHtml ?? raw.content ?? '';
  const text = raw.contentText ?? raw.textContent ?? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    title: raw.title ?? '',
    url: raw.url ?? url,
    siteName: raw.siteName ?? '',
    author: raw.author ?? '',
    publishedAt: raw.publishedAt ?? '',
    excerpt: raw.excerpt ?? text.slice(0, 280).trim(),
    contentHtml: html,
    contentText: text,
    image: raw.image ?? '',
    readingTime: raw.readingTime ?? Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 200)),
  };
}

async function buildMarkdown(extract: ExtractResult, meta: PageMetadata, rawContent: string): Promise<string> {
  let fm = '---\n';
  const add = (k: string, v: string | undefined) => { if (v) fm += `${k}: "${v.replace(/"/g, '\\"')}"\n`; };
  add('title', meta.title || extract.title);
  add('url', extract.url);
  add('site_name', meta.siteName || extract.siteName);
  add('author', meta.author || extract.author);
  add('published_at', meta.publishedAt || extract.publishedAt || undefined);
  add('description', meta.description || extract.excerpt);
  add('image', extract.image || undefined);
  add('favicon_url', meta.faviconUrl || undefined);
  add('lang', meta.lang || undefined);
  if (extract.readingTime) add('reading_time', String(extract.readingTime));
  add('captured_at', new Date().toISOString());
  fm += '---\n\n';

  try {
    const { createMarkdownContent } = await import('defuddle/full');
    return fm + createMarkdownContent(rawContent, extract.url);
  } catch {
    return fm + htmlToMarkdown(extract.contentHtml);
  }
}

function extractPageMetadata(doc: Document, url: string): PageMetadata {
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '';
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ?? '';
  const ogSite = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? '';
  const ogAuthor = doc.querySelector('meta[property="article:author"]')?.getAttribute('content') ?? '';
  const ogPub = doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ?? '';
  const ogLocale = doc.querySelector('meta[property="og:locale"]')?.getAttribute('content') ?? '';

  let jsonTitle = '', jsonDesc = '', jsonSite = '', jsonAuthor = '', jsonPub = '';
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const j = JSON.parse(s.textContent ?? '');
      const nodes: any[] = j['@graph'] ?? [j];
      for (const n of nodes) {
        if (n['@type'] === 'WebSite') jsonSite = jsonSite || n.name || '';
        if (n['@type'] === 'Article' || n['@type'] === 'BlogPosting' || n['@type'] === 'NewsArticle') {
          jsonTitle = jsonTitle || n.headline || n.name || '';
          jsonDesc = jsonDesc || n.description || '';
          jsonPub = jsonPub || n.datePublished || '';
          if (n.author) jsonAuthor = jsonAuthor || (typeof n.author === 'string' ? n.author : n.author?.name ?? '');
        }
      }
      if (jsonTitle || jsonSite) break;
    } catch {}
  }

  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  const metaAuthor = doc.querySelector('meta[name="author"]')?.getAttribute('content') ?? '';
  const twitterSite = (doc.querySelector('meta[name="twitter:site"]')?.getAttribute('content') ?? '').replace(/^@/, '');
  const dateMeta = doc.querySelector('meta[name="date"],meta[name="published_at"],meta[name="DC.date"],meta[name="dcterms.created"]')?.getAttribute('content') ?? '';

  const iconLink = doc.querySelector('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"],link[rel="apple-touch-icon-precomposed"]');
  let favicon = '/favicon.ico';
  if (iconLink) {
    const href = iconLink.getAttribute('href');
    if (href) {
      try { favicon = new URL(href, doc.querySelector('base')?.getAttribute('href') ?? doc.baseURI).href; } catch {}
    }
  } else {
    try { favicon = new URL('/favicon.ico', doc.baseURI).href; } catch {}
  }

  let siteName = '';
  try { const h = new URL(url).hostname.replace(/^www\./, ''); siteName = h.charAt(0).toUpperCase() + h.slice(1); } catch {}

  return {
    title: ogTitle || jsonTitle || doc.title || url,
    url,
    siteName: ogSite || jsonSite || twitterSite || siteName,
    author: ogAuthor || jsonAuthor || metaAuthor,
    publishedAt: ogPub || jsonPub || dateMeta,
    description: ogDesc || jsonDesc || metaDesc,
    faviconUrl: favicon,
    lang: (ogLocale ? ogLocale.split('_')[0] : '') || doc.documentElement.lang || navigator.language || 'en',
  };
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n')
    .replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*')
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img[^>]*src=["']([^"']*)["'][^>]*\/?>/gi, '![]($1)')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/?[ou]l[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<blockquote[^>]*>/gi, '\n> ')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<pre[^>]*><code[^>]*>/gi, '\n```\n')
    .replace(/<\/code><\/pre>/gi, '\n```\n')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim();
}
