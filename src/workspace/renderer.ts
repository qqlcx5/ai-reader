/**
 * Streaming Renderer
 *
 * Manages incremental rendering of streaming LLM output with rAF
 * (requestAnimationFrame) throttling to maintain 45+ fps scrolling.
 *
 * Strategy:
 * - Accumulate deltas into a buffer per provider
 * - Flush buffer every rAF frame (max ~16ms interval)
 * - Cache rendered HTML for completed messages to avoid re-rendering
 * - Support per-provider rendering via callback
 *
 * Based on design-04-workspace.md §5.
 */

// ─── Types ────────────────────────────────────────────────────────────

export interface RendererConfig {
  /** Maximum characters to accumulate before forcing a flush */
  maxBufferSize: number;
  /** Debounce time in ms between flushes (via rAF, typically ~16ms) */
  frameBudget: number;
}

export interface RenderFunction {
  (providerId: string, markdown: string): void;
}

const DEFAULT_CONFIG: RendererConfig = {
  maxBufferSize: 500,
  frameBudget: 16,
};

// ─── StreamingRenderer ────────────────────────────────────────────────

export class StreamingRenderer {
  private config: RendererConfig;
  private buffers = new Map<string, string[]>();
  private renderScheduled = new Set<string>();
  private renderFn: RenderFunction;
  private cache = new Map<string, string>();

  constructor(
    renderFn: RenderFunction,
    config: Partial<RendererConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.renderFn = renderFn;
  }

  /**
   * Push a delta chunk for a provider. Accumulates in buffer;
   * schedules a rAF flush if not already scheduled.
   */
  push(providerId: string, delta: string): void {
    if (!this.buffers.has(providerId)) {
      this.buffers.set(providerId, []);
    }

    const buffer = this.buffers.get(providerId)!;
    buffer.push(delta);

    // Schedule flush when buffer exceeds threshold or on first chunk
    if (buffer.length >= this.config.maxBufferSize) {
      this.flushSync(providerId);
    } else {
      this.scheduleFlush(providerId);
    }
  }

  /**
   * Flush all pending buffers immediately.
   * Called when streaming completes or on tab switch.
   */
  flushAll(): void {
    for (const pid of this.buffers.keys()) {
      this.flushSync(pid);
    }
  }

  /**
   * Get the current accumulated content for a provider.
   */
  getContent(providerId: string): string {
    const buffer = this.buffers.get(providerId) || [];
    return buffer.join('');
  }

  /**
   * Check if a provider has pending (unflushed) content.
   */
  hasPending(providerId: string): boolean {
    const buffer = this.buffers.get(providerId);
    return !!buffer && buffer.length > 0;
  }

  /**
   * Cache the final rendered HTML for a completed provider.
   */
  cacheResult(providerId: string, html: string): void {
    this.cache.set(providerId, html);
  }

  /**
   * Get cached HTML for a provider.
   */
  getCached(providerId: string): string | undefined {
    return this.cache.get(providerId);
  }

  /**
   * Reset state for a new conversation or re-render.
   */
  reset(): void {
    this.buffers.clear();
    this.renderScheduled.clear();
    this.cache.clear();
  }

  /**
   * Remove a specific provider's buffers and cache.
   */
  removeProvider(providerId: string): void {
    this.buffers.delete(providerId);
    this.renderScheduled.delete(providerId);
    this.cache.delete(providerId);
  }

  // ─── Internal ────────────────────────────────────────────────────

  private scheduleFlush(providerId: string): void {
    if (this.renderScheduled.has(providerId)) return;
    this.renderScheduled.add(providerId);

    requestAnimationFrame(() => {
      this.renderScheduled.delete(providerId);
      this.flushSync(providerId);
    });
  }

  private flushSync(providerId: string): void {
    const buffer = this.buffers.get(providerId);
    if (!buffer || buffer.length === 0) return;

    const content = buffer.join('');
    buffer.length = 0;

    this.renderFn(providerId, content);
  }
}

// ─── Markdown Renderer Factory ───────────────────────────────────────

/**
 * Create a render function that converts Markdown to HTML using a
 * Markdown parser (markdown-it or similar).
 *
 * Usage:
 * ```ts
 * const renderer = createMarkdownRenderer(md => markdownIt.render(md));
 * const streamRenderer = new StreamingRenderer(renderer);
 * streamRenderer.push('openai', '# Hello');
 * ```
 */
export function createMarkdownRenderer(
  mdToHtml: (markdown: string) => string,
): RenderFunction {
  return (providerId: string, markdown: string) => {
    const html = mdToHtml(markdown);
    // The actual DOM update is handled by the framework (Vue/React/vanilla)
    // via a custom event or direct callback
    dispatchRenderEvent(providerId, html);
  };
}

// ─── Render Event Dispatcher ─────────────────────────────────────────

type RenderEventHandler = (providerId: string, html: string) => void;

let renderHandler: RenderEventHandler | null = null;

/**
 * Register a handler for render events.
 * Called by the UI component to receive rendered HTML.
 */
export function onRender(handler: RenderEventHandler): void {
  renderHandler = handler;
}

function dispatchRenderEvent(providerId: string, html: string): void {
  if (renderHandler) {
    try {
      renderHandler(providerId, html);
    } catch (err) {
      console.error(`[StreamingRenderer] Render handler error for ${providerId}:`, err);
    }
  }
}

// ─── Utility: Measure Scroll Performance ─────────────────────────────

/**
 * Simple FPS monitor for testing scroll performance during streaming.
 * Reports average FPS over the monitoring window.
 */
export function createFpsMonitor(windowMs: number = 2000): {
  recordFrame: () => void;
  getFps: () => number;
  stop: () => void;
} {
  let frameCount = 0;
  let startTime = performance.now();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastFps = 0;

  intervalId = setInterval(() => {
    const elapsed = (performance.now() - startTime) / 1000;
    lastFps = elapsed > 0 ? frameCount / elapsed : 0;
    frameCount = 0;
    startTime = performance.now();
  }, windowMs);

  return {
    recordFrame: () => {
      frameCount++;
    },
    getFps: () => lastFps,
    stop: () => {
      if (intervalId) clearInterval(intervalId);
    },
  };
}
