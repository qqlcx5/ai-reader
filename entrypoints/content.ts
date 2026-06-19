import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.action === 'extractContent') {
        extractContent().then(sendResponse);
        return true; // async response
      }
    });
  },
});

async function waitForDocumentReady(timeoutMs = 5000): Promise<void> {
  if (document.readyState === 'complete') return;
  return new Promise((resolve) => {
    const onReady = () => {
      document.removeEventListener('readystatechange', onReady);
      resolve();
    };
    document.addEventListener('readystatechange', onReady);
    setTimeout(() => {
      document.removeEventListener('readystatechange', onReady);
      resolve();
    }, timeoutMs);
  });
}

async function extractContent() {
  await waitForDocumentReady();

  const url = document.URL;
  const title = document.title || '';

  // Tier 1: defuddle async (with 8s timeout)
  try {
    const Defuddle = (await import('defuddle')).default;
    const defuddle = new Defuddle(document, { url });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('defuddle timeout')), 8000)
    );
    const result = await Promise.race([defuddle.parseAsync(), timeout]);
    if (result.content && result.content.trim().length > 0) {
      return {
        title: result.title || title,
        content: result.contentMarkdown || result.content,
        url,
        wordCount: result.wordCount || 0,
      };
    }
  } catch {
    // fall through to sync parse
  }

  // Tier 2: defuddle sync fallback
  try {
    const Defuddle = (await import('defuddle')).default;
    const defuddle = new Defuddle(document, { url });
    const result = defuddle.parse();
    if (result.content && result.content.trim().length > 0) {
      return {
        title: result.title || title,
        content: result.contentMarkdown || result.content,
        url,
        wordCount: result.wordCount || 0,
      };
    }
  } catch {
    // fall through to innerText
  }

  // Tier 3: raw innerText fallback
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
  const innerText = clone.innerText.trim();

  if (innerText.length === 0) {
    return {
      error: 'extraction_failed',
      message: '无法提取页面内容，页面可能为空或受保护',
      title,
      url,
      content: '',
      wordCount: 0,
    };
  }

  return {
    title,
    content: innerText,
    url,
    wordCount: innerText.split(/\s+/).filter(Boolean).length,
  };
}
