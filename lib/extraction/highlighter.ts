/**
 * M2 — Highlight selection module
 *
 * Captures user text selections on a page, applies visual highlight marks,
 * and persists records to a Dexie Highlights table (via an injected
 * HighlightsRepository). Falls back to an in-memory store when M8 is not
 * yet integrated.
 *
 * Usage (content script):
 *   const hl = new Highlighter({ pageId, onHighlight });
 *   hl.mount();        // start listening
 *   await hl.restore() // reload saved highlights on page open
 *   hl.unmount();      // clean up on script teardown
 *
 * Dexie integration:
 *   import { setHighlightsRepository } from '@/lib/extraction/highlighter';
 *   setHighlightsRepository(new DexieHighlightsRepo(db));
 */
import type { HighlightRecord, HighlightStyle, HighlightMode } from './types';

// ─── Repository interface (fulfilled by M8 when available) ────────────────────

export interface HighlightsRepository {
  add(record: HighlightRecord): Promise<void>;
  getByPageId(pageId: string): Promise<HighlightRecord[]>;
  getByDomain(domain: string): Promise<HighlightRecord[]>;
  remove(id: string): Promise<void>;
  clear(pageId: string): Promise<void>;
}

// ─── In-memory fallback store ─────────────────────────────────────────────────

const memStore: HighlightRecord[] = [];

const memRepo: HighlightsRepository = {
  async add(record) {
    memStore.push(record);
  },
  async getByPageId(pageId) {
    return memStore.filter((r) => r.pageId === pageId);
  },
  async getByDomain(domain) {
    return memStore.filter((r) => r.domain === domain);
  },
  async remove(id) {
    const idx = memStore.findIndex((r) => r.id === id);
    if (idx !== -1) memStore.splice(idx, 1);
  },
  async clear(pageId) {
    const ids = memStore.filter((r) => r.pageId === pageId).map((r) => r.id);
    ids.forEach((id) => {
      const idx = memStore.findIndex((r) => r.id === id);
      if (idx !== -1) memStore.splice(idx, 1);
    });
  },
};

let _repo: HighlightsRepository = memRepo;

/** Inject the real Dexie-backed repository (called by M8 integration layer). */
export function setHighlightsRepository(repo: HighlightsRepository): void {
  _repo = repo;
}

// ─── Style constants ──────────────────────────────────────────────────────────

const CLASS_MAP: Record<HighlightStyle, string> = {
  mark: 'ai-hl--mark',
  underline: 'ai-hl--underline',
  blur: 'ai-hl--blur',
  wave: 'ai-hl--wave',
  bold: 'ai-hl--bold',
  italic: 'ai-hl--italic',
};

const GLOBAL_CSS = `
.ai-hl--mark { background-color: #FFE066; color: inherit; border-radius: 2px; padding: 0 1px; }
.ai-hl--underline { text-decoration: underline dotted 2px #F5A623; text-underline-offset: 2px; }
.ai-hl--blur { filter: blur(4px); transition: filter .25s; cursor: pointer; }
.ai-hl--blur:hover { filter: none; }
.ai-hl--wave { text-decoration: underline wavy #4CAF50; text-underline-offset: 2px; }
.ai-hl--bold { font-weight: bold; }
.ai-hl--italic { font-style: italic; }
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.id = 'ai-reader-hl-css';
  style.textContent = GLOBAL_CSS;
  document.head?.appendChild(style);
  stylesInjected = true;
}

// ─── CSS selector generation ──────────────────────────────────────────────────

function getCssSelector(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.documentElement) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      part = `#${CSS.escape(node.id)}`;
      parts.unshift(part);
      break;
    }
    const parent = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === node!.tagName,
      );
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    node = node.parentElement;
  }
  return parts.join(' > ');
}

function generateId(): string {
  return `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── DOM highlight manipulation ───────────────────────────────────────────────

function applyHighlight(range: Range, id: string, style: HighlightStyle): void {
  const mark = document.createElement('mark');
  mark.dataset.hlId = id;
  mark.className = CLASS_MAP[style];
  mark.setAttribute('data-hl-style', style);
  try {
    range.surroundContents(mark);
  } catch {
    // Cross-element selections: extract + rewrap
    const fragment = range.extractContents();
    mark.appendChild(fragment);
    range.insertNode(mark);
  }
}

function removeHighlightFromDom(id: string): void {
  const el = document.querySelector(`[data-hl-id="${id}"]`);
  if (!el) return;
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

// ─── Highlighter class ────────────────────────────────────────────────────────

export interface HighlighterOptions {
  pageId: string;
  defaultStyle?: HighlightStyle;
  onHighlight?: (record: HighlightRecord) => void;
}

export class Highlighter {
  private pageId: string;
  private defaultStyle: HighlightStyle;
  private onHighlight?: (record: HighlightRecord) => void;
  private boundMouseUp: () => void;

  constructor(options: HighlighterOptions) {
    this.pageId = options.pageId;
    this.defaultStyle = options.defaultStyle ?? 'mark';
    this.onHighlight = options.onHighlight;
    this.boundMouseUp = () => void this.handleMouseUp();
  }

  /** Start listening for text selections. */
  mount(): void {
    injectStyles();
    document.addEventListener('mouseup', this.boundMouseUp);
  }

  /** Stop listening. */
  unmount(): void {
    document.removeEventListener('mouseup', this.boundMouseUp);
  }

  // ── Event handler ──────────────────────────────────────────────────────

  private async handleMouseUp(): Promise<void> {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const anchor = selection.anchorNode;
    const el: Element | null =
      anchor instanceof Element ? anchor : anchor?.parentElement ?? null;
    if (!el) return;

    const id = generateId();
    const record: HighlightRecord = {
      id,
      pageId: this.pageId,
      selector: getCssSelector(el),
      text,
      style: this.defaultStyle,
      createdAt: Date.now(),
      url: location.href,
      domain: location.hostname,
    };

    applyHighlight(range, id, this.defaultStyle);
    selection.removeAllRanges();

    await _repo.add(record);
    this.onHighlight?.(record);
  }

  // ── Public management API ──────────────────────────────────────────────

  /** Update the visual style of an existing highlight. */
  async changeStyle(id: string, style: HighlightStyle): Promise<void> {
    const el = document.querySelector<HTMLElement>(`[data-hl-id="${id}"]`);
    if (!el) return;
    Object.values(CLASS_MAP).forEach((cls) => el.classList.remove(cls));
    el.classList.add(CLASS_MAP[style]);
    el.setAttribute('data-hl-style', style);
  }

  /** Remove a highlight from the DOM and from persistence. */
  async removeHighlight(id: string): Promise<void> {
    removeHighlightFromDom(id);
    await _repo.remove(id);
  }

  /**
   * Re-apply all stored highlights for this page.
   * Call this after the page finishes loading.
   */
  async restore(): Promise<void> {
    injectStyles();
    const records = await _repo.getByPageId(this.pageId);
    records.forEach((r) => this.restoreRecord(r));
  }

  private restoreRecord(record: HighlightRecord): void {
    try {
      const el = document.querySelector(record.selector);
      if (!el) return;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const idx = (node.textContent ?? '').indexOf(record.text);
        if (idx === -1) continue;
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + record.text.length);
        applyHighlight(range, record.id, record.style);
        break;
      }
    } catch (err) {
      console.warn('[M2/highlighter] Failed to restore', record.id, err);
    }
  }

  /** Get all highlight records for this page. */
  async getHighlights(): Promise<HighlightRecord[]> {
    return _repo.getByPageId(this.pageId);
  }

  /**
   * Build Markdown from the base content, applying the requested highlight mode.
   *
   * - 'embedded'  Wraps each highlighted span in ==…== (Obsidian syntax)
   * - 'only'      Returns a numbered list of highlighted texts only
   * - 'ignored'   Returns baseMarkdown unchanged
   */
  async buildMarkdown(baseMarkdown: string, mode: HighlightMode): Promise<string> {
    const records = await _repo.getByPageId(this.pageId);
    if (mode === 'ignored' || records.length === 0) return baseMarkdown;

    if (mode === 'only') {
      return records.map((r, i) => `${i + 1}. ==${r.text}==`).join('\n');
    }

    // 'embedded': surround each occurrence with ==…==
    let result = baseMarkdown;
    for (const record of records) {
      const escaped = record.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'g'), `==${record.text}==`);
    }
    return result;
  }

  /**
   * Export all highlights for the given domain as a JSON string.
   * Suitable for direct download as a .json file.
   */
  async exportByDomain(domain: string): Promise<string> {
    const records = await _repo.getByDomain(domain);
    return JSON.stringify(records, null, 2);
  }
}
