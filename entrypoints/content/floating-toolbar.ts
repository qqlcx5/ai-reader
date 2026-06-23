/**
 * M2 — Floating toolbar with Shadow DOM isolation
 *
 * Appears above the user's text selection on any page.
 * Provides four quick actions: 解释 / 总结 / 翻译 / 提问.
 *
 * The toolbar container lives in the host DOM but its internal markup is
 * rendered inside a Shadow Root (`attachShadow({ mode: 'open' })`), so no
 * host-page CSS can leak in or out.
 *
 * Position calculation:
 *   - Anchored above the selection via Range.getBoundingClientRect()
 *   - Automatically flipped below when too close to the top of the viewport
 *   - Clamped to horizontal viewport edges
 *
 * Lifecycle:
 *   const toolbar = new FloatingToolbar((action, text) => { … });
 *   toolbar.mount();    // start listening for selections
 *   toolbar.unmount();  // clean up (call on content-script teardown)
 */

export type ToolbarAction = 'explain' | 'summarize' | 'translate' | 'ask';
export type ToolbarActionCallback = (action: ToolbarAction, text: string) => void;

// ─── Self-contained shadow CSS ────────────────────────────────────────────────

const SHADOW_CSS = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: block;
}
.toolbar {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: #1e1e2e;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.07);
  white-space: nowrap;
}
button {
  all: unset;
  cursor: pointer;
  padding: 4px 9px;
  border-radius: 5px;
  color: #cdd6f4;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  transition: background 0.12s ease, color 0.12s ease;
  user-select: none;
}
button:hover {
  background: #313244;
  color: #fff;
}
button:active {
  background: #45475a;
}
.sep {
  width: 1px;
  height: 16px;
  background: #45475a;
  margin: 0 1px;
  flex-shrink: 0;
}
`;

const ACTIONS: { id: ToolbarAction; label: string }[] = [
  { id: 'explain', label: '解释' },
  { id: 'summarize', label: '总结' },
  { id: 'translate', label: '翻译' },
  { id: 'ask', label: '提问' },
];

// ─── FloatingToolbar class ────────────────────────────────────────────────────

export class FloatingToolbar {
  private onAction: ToolbarActionCallback;
  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private selectedText = '';

  private onMouseUp = (): void => {
    // Defer so the browser has time to finalise the selection object
    requestAnimationFrame(() => this.handleSelectionChange());
  };

  private onDocClick = (e: MouseEvent): void => {
    if (this.host && !this.host.contains(e.target as Node)) {
      this.hide();
    }
  };

  constructor(onAction: ToolbarActionCallback) {
    this.onAction = onAction;
  }

  /** Attach event listeners. Call once when the content script loads. */
  mount(): void {
    document.addEventListener('mouseup', this.onMouseUp);
  }

  /** Remove all listeners and destroy the DOM node. */
  unmount(): void {
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('click', this.onDocClick);
    this.host?.remove();
    this.host = null;
    this.shadow = null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private handleSelectionChange(): void {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';
    if (!text) {
      this.hide();
      return;
    }
    this.selectedText = text;

    const range = selection!.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    this.show(rect);
  }

  private show(selRect: DOMRect): void {
    if (!this.host) this.build();

    const TOOLBAR_H = 40;
    const TOOLBAR_W = 220; // conservative estimate
    const MARGIN = 8;

    let top = selRect.top + window.scrollY - TOOLBAR_H - MARGIN;
    let left = selRect.left + window.scrollX + selRect.width / 2 - TOOLBAR_W / 2;

    // Flip below selection when too close to the top
    if (top < window.scrollY + MARGIN) {
      top = selRect.bottom + window.scrollY + MARGIN;
    }

    // Clamp to horizontal viewport
    const maxLeft = window.scrollX + window.innerWidth - TOOLBAR_W - MARGIN;
    left = Math.max(window.scrollX + MARGIN, Math.min(left, maxLeft));

    const host = this.host!;
    host.style.top = `${top}px`;
    host.style.left = `${left}px`;
    host.style.display = 'block';

    // Register click-outside after a tick so this mouseup doesn't immediately
    // dismiss the toolbar
    setTimeout(() => {
      document.addEventListener('click', this.onDocClick);
    }, 0);
  }

  private hide(): void {
    if (this.host) this.host.style.display = 'none';
    document.removeEventListener('click', this.onDocClick);
  }

  private build(): void {
    const host = document.createElement('div');
    host.id = 'ai-reader-floating-toolbar';
    host.style.cssText = [
      'position: absolute',
      'z-index: 2147483647',
      'display: none',
      'pointer-events: auto',
    ].join(';');

    // Shadow DOM — fully isolated from host-page styles
    const shadow = host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = SHADOW_CSS;

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    ACTIONS.forEach((action, idx) => {
      if (idx > 0) {
        const sep = document.createElement('div');
        sep.className = 'sep';
        toolbar.appendChild(sep);
      }

      const btn = document.createElement('button');
      btn.textContent = action.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const capturedText = this.selectedText;
        this.hide();
        this.onAction(action.id, capturedText);
      });
      toolbar.appendChild(btn);
    });

    shadow.appendChild(styleEl);
    shadow.appendChild(toolbar);
    document.body.appendChild(host);

    this.host = host;
    this.shadow = shadow;
  }
}
