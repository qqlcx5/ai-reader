import Defuddle from 'defuddle';
import { createMarkdownContent } from 'defuddle/full';

// MAIN world content script - 可以访问 DOM 和 defuddle
// 通过 window.postMessage 与 ISOLATED world 通信

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  runAt: 'document_idle',
  main() {
    const existing = document.getElementById('readchat-capture-btn');
    if (existing) return;

    console.log('ReadChat MAIN world content script injected');

    const button = document.createElement('div');
    button.id = 'readchat-capture-btn';
    button.innerHTML = '📖';
    button.title = 'ReadChat - 捕获此页';
    Object.assign(button.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      background: '#6366f1',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      zIndex: '2147483647',
      transition: 'transform 0.2s, box-shadow 0.2s',
      userSelect: 'none',
    });

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    });

    button.addEventListener('click', async () => {
      button.style.opacity = '0.5';
      button.style.pointerEvents = 'none';
      button.innerHTML = '⏳';

      try {
        const doc = await capturePage();
        window.postMessage({
          type: 'READCHAT_CAPTURE_RESULT',
          document: doc,
        }, '*');
        button.innerHTML = '✅';
        setTimeout(() => {
          button.innerHTML = '📖';
          button.style.opacity = '1';
          button.style.pointerEvents = 'auto';
        }, 2000);
      } catch (err) {
        console.error('ReadChat capture failed:', err);
        button.innerHTML = '❌';
        setTimeout(() => {
          button.innerHTML = '📖';
          button.style.opacity = '1';
          button.style.pointerEvents = 'auto';
        }, 2000);
      }
    });

    document.body.appendChild(button);
  },
});

async function capturePage(): Promise<Record<string, unknown>> {
  const defuddle = new Defuddle(document, { url: document.URL });
  const parseTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('parseAsync timeout')), 8000),
  );

  let parsed: { content: string; title?: string; author?: string; description?: string; image?: string; [key: string]: unknown };
  try {
    parsed = await Promise.race([defuddle.parseAsync(), parseTimeout]);
  } catch {
    return createFallbackDocument();
  }

  const url = location.href;
  const markdownContent = createMarkdownContent(parsed.content, url);

  const title = parsed.title || document.title || 'Untitled';
  const author = (parsed.author as string) || extractMeta('author') || extractJsonLdAuthor();
  const publishedAt = extractMeta('article:published_time') || extractMeta('date') || extractJsonLdDate();
  const favicon = extractFavicon();
  const description = (parsed.description as string) || extractMeta('description') || extractMeta('og:description');
  const keywords = extractKeywords();
  const siteName = extractMeta('og:site_name') || extractSiteName();
  const image = (parsed.image as string) || extractMeta('og:image');
  const wordCount = countWords(markdownContent);
  const language = document.documentElement.lang || 'en';
  const schemaOrgData = extractSchemaOrg();

  return {
    id: generateDocId(),
    title,
    url,
    author: author || undefined,
    publishedAt: publishedAt || undefined,
    favicon: favicon || undefined,
    description: description || undefined,
    keywords,
    markdownContent,
    siteName: siteName || undefined,
    image: image || undefined,
    wordCount,
    language,
    schemaOrgData: schemaOrgData || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createFallbackDocument(): Record<string, unknown> {
  const url = location.href;
  const bodyText = document.body.innerText || '';
  const markdownContent = `# ${document.title || 'Untitled'}\n\n${bodyText}`;

  return {
    id: generateDocId(),
    title: document.title || 'Untitled',
    url,
    description: extractMeta('description') || extractMeta('og:description') || undefined,
    markdownContent,
    wordCount: countWords(markdownContent),
    language: document.documentElement.lang || 'en',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function generateDocId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function extractMeta(name: string): string | null {
  const el =
    document.querySelector(`meta[name="${name}"]`) ||
    document.querySelector(`meta[property="${name}"]`);
  return el?.getAttribute('content') || null;
}

function extractFavicon(): string | null {
  const link = document.querySelector('link[rel*="icon"]') as HTMLLinkElement | null;
  return link?.href || null;
}

function extractKeywords(): string[] {
  const content = extractMeta('keywords');
  if (!content) return [];
  return content.split(',').map((k) => k.trim()).filter(Boolean);
}

function extractSiteName(): string | null {
  return extractMeta('og:site_name') || new URL(location.href).hostname;
}

function extractJsonLdAuthor(): string | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      if (data.author) {
        if (typeof data.author === 'string') return data.author;
        if (data.author.name) return data.author.name;
        if (Array.isArray(data.author) && data.author[0]?.name) return data.author[0].name;
      }
    } catch { /* ignore */ }
  }
  return null;
}

function extractJsonLdDate(): string | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      if (data.datePublished) return data.datePublished;
      if (data.dateCreated) return data.dateCreated;
    } catch { /* ignore */ }
  }
  return null;
}

function extractSchemaOrg(): Record<string, unknown> | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      if (data['@type']) return data as Record<string, unknown>;
    } catch { /* ignore */ }
  }
  return null;
}

function countWords(text: string): number {
  const chinese = text.match(/[一-鿿]/g)?.length || 0;
  const english = text.replace(/[一-鿿]/g, ' ').split(/\s+/).filter(Boolean).length;
  return chinese + english;
}
