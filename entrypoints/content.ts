import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import Defuddle from 'defuddle';

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

async function extractContent() {
  const url = document.URL;
  const title = document.title || '';

  // Tier 1: defuddle async (with 8s timeout)
  try {
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
  return {
    title,
    content: clone.innerText.trim(),
    url,
    wordCount: clone.innerText.split(/\s+/).filter(Boolean).length,
  };
}
