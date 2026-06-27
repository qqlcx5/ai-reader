// ============================================================
// SuperBrain Content Script – Perception Capture Layer (Lightweight)
// ============================================================

import type { PageMetadata, CaptureStep } from '../shared/domain';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // ---- Generation Counter (zombie script guard) ----
    (window as any).__pageMindGeneration =
      ((window as any).__pageMindGeneration ?? 0) + 1;
    const myGeneration: number = (window as any).__pageMindGeneration;

    console.log(`[SuperBrain] Content script loaded gen=${myGeneration}`);

    // ---- Message Router ----
    browser.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
      if ((window as any).__pageMindGeneration !== myGeneration) {
        sendResponse({ error: 'STALE_SCRIPT' });
        return false;
      }

      if (!message || !message.type) return false;

      switch (message.type) {
        case 'ping':
          sendResponse({ generation: myGeneration, status: 'ready' });
          return true;

        case 'EXTRACT_PAGE': {
          // Delegate to background for injection-based extraction
          handleExtractPage(sendResponse);
          return true;
        }

        case 'GET_PAGE_METADATA': {
          handleGetMetadata(sendResponse);
          return false; // synchronous
        }

        default:
          return false;
      }
    });

    // ---- EXTRACT_PAGE: ask background to inject extractor ----
    async function handleExtractPage(sendResponse: (resp: any) => void): Promise<void> {
      try {
        // Ask background to do the extraction (it injects extractor script)
        const result = await browser.runtime.sendMessage({
          type: 'EXTRACT_PAGE',
          payload: { url: window.location.href },
        });
        sendResponse(result);
      } catch (err: any) {
        sendResponse({ status: 'error', error: err?.message || String(err) });
      }
    }

    // ---- GET_PAGE_METADATA (lightweight – no defuddle needed) ----
    function handleGetMetadata(sendResponse: (resp: any) => void): void {
      try {
        const metadata = extractPageMetadata(document, window.location.href);
        sendResponse({ status: 'ok', data: metadata });
      } catch (err: any) {
        sendResponse({ status: 'error', error: err?.message || String(err) });
      }
    }
  },
});

// ============================================================
// Lightweight Metadata Extraction (no defuddle dependency)
// ============================================================

function extractPageMetadata(doc: Document, url: string): PageMetadata {
  // OG tags
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '';
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ?? '';
  const ogSite = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? '';
  const ogAuthor = doc.querySelector('meta[property="article:author"]')?.getAttribute('content') ?? '';
  const ogPub = doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ?? '';
  const ogLocale = doc.querySelector('meta[property="og:locale"]')?.getAttribute('content') ?? '';

  // JSON-LD
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

  // HTML meta
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
  const metaAuthor = doc.querySelector('meta[name="author"]')?.getAttribute('content') ?? '';
  const twitterSite = (doc.querySelector('meta[name="twitter:site"]')?.getAttribute('content') ?? '').replace(/^@/, '');
  const dateMeta = doc.querySelector('meta[name="date"],meta[name="published_at"],meta[name="DC.date"],meta[name="dcterms.created"]')?.getAttribute('content') ?? '';

  // Favicon
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

  // Heuristic site name
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
