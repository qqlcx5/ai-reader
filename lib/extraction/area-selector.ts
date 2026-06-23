/**
 * M2 — Manual area selection (drag-to-select fallback)
 *
 * When ExtractionResult.confidence === 'low', the UI shows a banner inviting
 * the user to manually select an area of the page. This module:
 *   1. Overlays the page with a semi-transparent dimming layer
 *   2. Lets the user drag a rectangle with the mouse
 *   3. Collects DOM elements inside the rectangle via document.elementsFromPoint()
 *   4. Extracts their text and returns it as plain Markdown
 *
 * Usage (content script):
 *   const selector = new AreaSelector((result) => {
 *     // result.markdown replaces ExtractionResult.markdown
 *   });
 *   selector.activate();   // show overlay
 *   selector.deactivate(); // cancel programmatically
 */

export interface AreaSelectionResult {
  /** Plain text / Markdown extracted from the selected region */
  markdown: string;
  /** All DOM elements found inside the selection rectangle */
  elements: Element[];
}

export type AreaSelectorCallback = (result: AreaSelectionResult) => void;

// ─── Inline styles (no external CSS dependency) ───────────────────────────────

const OVERLAY_CSS = [
  'position: fixed',
  'top: 0',
  'left: 0',
  'width: 100vw',
  'height: 100vh',
  'z-index: 2147483646',
  'cursor: crosshair',
  'background: rgba(0,0,0,0.18)',
  'user-select: none',
  '-webkit-user-select: none',
].join(';');

const RECT_CSS = [
  'position: fixed',
  'border: 2px dashed #7c3aed',
  'background: rgba(124,58,237,0.08)',
  'pointer-events: none',
  'z-index: 2147483647',
  'box-sizing: border-box',
  'display: none',
].join(';');

// ─── Area selector class ──────────────────────────────────────────────────────

export class AreaSelector {
  private callback: AreaSelectorCallback;
  private overlay: HTMLDivElement | null = null;
  private selRect: HTMLDivElement | null = null;
  private startX = 0;
  private startY = 0;
  private active = false;

  constructor(callback: AreaSelectorCallback) {
    this.callback = callback;
  }

  /** Show the drag-to-select overlay. */
  activate(): void {
    if (this.active) return;
    this.active = true;
    this.buildOverlay();
  }

  /** Hide the overlay without triggering extraction. */
  deactivate(): void {
    this.teardown();
    this.active = false;
  }

  // ── Overlay construction ─────────────────────────────────────────────────

  private buildOverlay(): void {
    const overlay = document.createElement('div');
    overlay.id = 'ai-reader-area-selector';
    overlay.style.cssText = OVERLAY_CSS;

    const rect = document.createElement('div');
    rect.style.cssText = RECT_CSS;
    overlay.appendChild(rect);

    overlay.addEventListener('mousedown', this.onMouseDown);
    // Prevent default text selection while dragging
    overlay.addEventListener('dragstart', (e) => e.preventDefault());

    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.selRect = rect;
  }

  private teardown(): void {
    if (!this.overlay) return;
    this.overlay.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    this.overlay.remove();
    this.overlay = null;
    this.selRect = null;
  }

  // ── Mouse event handlers ─────────────────────────────────────────────────

  private onMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    this.startX = e.clientX;
    this.startY = e.clientY;

    if (this.selRect) {
      this.selRect.style.left = `${this.startX}px`;
      this.selRect.style.top = `${this.startY}px`;
      this.selRect.style.width = '0';
      this.selRect.style.height = '0';
      this.selRect.style.display = 'block';
    }

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.selRect) return;
    const x = Math.min(e.clientX, this.startX);
    const y = Math.min(e.clientY, this.startY);
    const w = Math.abs(e.clientX - this.startX);
    const h = Math.abs(e.clientY - this.startY);
    this.selRect.style.left = `${x}px`;
    this.selRect.style.top = `${y}px`;
    this.selRect.style.width = `${w}px`;
    this.selRect.style.height = `${h}px`;
  };

  private onMouseUp = (e: MouseEvent): void => {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);

    const x1 = Math.min(e.clientX, this.startX);
    const y1 = Math.min(e.clientY, this.startY);
    const x2 = Math.max(e.clientX, this.startX);
    const y2 = Math.max(e.clientY, this.startY);

    const result = this.extractFromRect(x1, y1, x2, y2);
    this.teardown();
    this.active = false;
    this.callback(result);
  };

  // ── Text extraction ──────────────────────────────────────────────────────

  private extractFromRect(x1: number, y1: number, x2: number, y2: number): AreaSelectionResult {
    const seen = new Set<Element>();
    const elements: Element[] = [];
    const STEP = 10; // sample every 10 px

    for (let x = x1; x <= x2; x += STEP) {
      for (let y = y1; y <= y2; y += STEP) {
        const hits = document.elementsFromPoint(x, y);
        for (const el of hits) {
          if (
            !seen.has(el) &&
            el.id !== 'ai-reader-area-selector' &&
            !el.closest('#ai-reader-area-selector')
          ) {
            seen.add(el);
            elements.push(el);
          }
        }
      }
    }

    // Collect leaf elements (no children) that contain text
    const textEls = elements.filter(
      (el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 0,
    );

    const lines: string[] = [];
    const seenText = new Set<string>();
    for (const el of textEls) {
      const text = (el.textContent ?? '').trim();
      if (text && !seenText.has(text)) {
        seenText.add(text);
        lines.push(text);
      }
    }

    return { markdown: lines.join('\n\n'), elements };
  }
}
