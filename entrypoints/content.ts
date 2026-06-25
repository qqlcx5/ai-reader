/**
 * Content Script 入口
 * 参考 doc/tasks/perception.md 章节 1, 2, 3
 * 参考 chrome-extensions skill 风险评估：使用默认 ISOLATED world
 *   - 不使用 world: 'MAIN'（降低 Store 审核风险）
 *   - DOM 在 ISOLATED world 完全可访问，defuddle 足够
 *   - 不污染页面 JS 上下文
 */
import { defineContentScript } from 'wxt/utils/define-content-script';
import Defuddle from 'defuddle';
import { onMessage } from '@/shared/messaging/runtime-client';
import { MessageType } from '@/shared/messaging/messages';
import type {
  ContentResponse,
  DocumentMetadata,
  ContentCapturePayload,
} from '@/shared/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  // 默认 ISOLATED world（不要使用 MAIN）
  runAt: 'document_idle',

  async main(ctx) {
    console.log('[ReadChat] content script loaded on', window.location.href);

    // 注入悬浮按钮
    const button = injectCaptureButton();
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = '⏳ 捕获中...';
      try {
        const payload = await captureCurrentPage();
        // 通过 background 保存（也通过 background 转发到 sidepanel）
        const response = await chrome.runtime.sendMessage({
          type: MessageType.CAPTURE_RESULT,
          payload,
          timestamp: Date.now(),
        });
        // 直接保存（避免绕一圈）
        await chrome.runtime.sendMessage({
          type: 'INTERNAL_SAVE_DOCUMENT',
          payload,
          timestamp: Date.now(),
        });
        button.textContent = '✅ 已捕获';
        setTimeout(() => {
          button.textContent = '📥 捕获到 ReadChat';
          button.disabled = false;
        }, 2000);
      } catch (err) {
        console.error('[ReadChat] capture error:', err);
        button.textContent = '❌ 失败';
        setTimeout(() => {
          button.textContent = '📥 捕获到 ReadChat';
          button.disabled = false;
        }, 2000);
      }
    });

    // 监听来自 background 的消息
    onMessage(async (envelope) => {
      if (envelope.type === MessageType.CAPTURE_PAGE) {
        // 让 background 转发给当前 tab
        return { success: true };
      }
      return undefined;
    });

    // 清理
    ctx.onInvalidated(() => {
      button.remove();
    });
  },
});

/**
 * 注入悬浮按钮
 */
function injectCaptureButton(): HTMLButtonElement {
  const id = 'readchat-capture-btn';
  const existing = document.getElementById(id);
  if (existing) return existing as HTMLButtonElement;

  const btn = document.createElement('button');
  btn.id = id;
  btn.textContent = '📥 捕获到 ReadChat';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '2147483647',
    padding: '10px 16px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as CSSStyleDeclaration);
  document.body.appendChild(btn);
  return btn;
}

/**
 * 捕获当前页面
 * 参考 doc/tasks/perception.md 章节 2, 3
 */
async function captureCurrentPage(): Promise<ContentCapturePayload> {
  let response: ContentResponse;
  try {
    // 克隆 document 避免污染当前页面
    const cloned = document.cloneNode(true) as Document;
    const defuddle = new Defuddle(cloned, { markdown: true });
    const result = defuddle.parse();
    response = {
      markdownContent: result.content || '',
      metadata: extractMetadata(result),
    };
  } catch (err) {
    console.warn('[ReadChat] defuddle failed, fallback:', err);
    // 降级：直接用 innerText
    response = {
      markdownContent: basicMarkdown(document.body.innerText || ''),
      metadata: extractBasicMetadata(),
    };
  }

  return {
    url: window.location.href,
    title: document.title || '',
    markdownContent: response.markdownContent,
    metadata: response.metadata,
  };
}

/**
 * 提取元数据（从 defuddle 结果）
 * 参考 doc/tasks/perception.md 章节 3
 */
function extractMetadata(result: unknown): DocumentMetadata {
  // defuddle 返回的对象包含 meta、schemaOrg 等
  const r = result as Record<string, unknown>;
  return {
    title: (r.title as string) || document.title || '',
    url: window.location.href,
    author: (r.author as string) || extractMetaContent('author'),
    description:
      (r.description as string) || extractMetaContent('description'),
    keywords: parseKeywords(extractMetaContent('keywords')),
    siteName:
      (r.site as string) ||
      extractMetaContent('og:site_name') ||
      window.location.hostname,
    image: (r.image as string) || extractMetaContent('og:image'),
    favicon: extractFavicon(),
    language: document.documentElement.lang || (r.lang as string) || '',
    wordCount: countWords(
      ((r.content as string) || (document.body.innerText as string)) || ''
    ),
    schemaOrgData: r.schemaOrgData,
    publishedAt:
      extractMetaContent('article:published_time') ||
      extractMetaContent('datePublished'),
  };
}

function extractBasicMetadata(): DocumentMetadata {
  return {
    title: document.title,
    url: window.location.href,
    description: extractMetaContent('description'),
    keywords: parseKeywords(extractMetaContent('keywords')),
    favicon: extractFavicon(),
    language: document.documentElement.lang,
    siteName: window.location.hostname,
    wordCount: countWords(document.body.innerText || ''),
  };
}

function extractMetaContent(name: string): string {
  // 1. 标准 meta
  let el = document.querySelector(
    `meta[name="${name}"]`
  ) as HTMLMetaElement | null;
  if (!el) {
    // 2. og: / twitter: / article:
    el = document.querySelector(
      `meta[property="${name}"]`
    ) as HTMLMetaElement | null;
  }
  return el?.content || '';
}

function extractFavicon(): string {
  const link = document.querySelector(
    'link[rel*="icon"]'
  ) as HTMLLinkElement | null;
  return link?.href || `${window.location.origin}/favicon.ico`;
}

function parseKeywords(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,，;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function countWords(text: string): number {
  if (!text) return 0;
  // 简单字数统计：中英文混合
  const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const en = (text.match(/[a-zA-Z]+/g) || []).length;
  return cn + en;
}

function basicMarkdown(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');
}
