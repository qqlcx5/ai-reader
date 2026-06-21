/**
 * M1 Entry & Layout — UI Event Bus
 *
 * Central event dispatcher for cross-module communication.
 * M2 / M4 / M5 / M6 subscribe to events; M1 dispatches them from
 * the entry points (Popup, Side Panel, Background).
 *
 * Based on design-01-entry-layout.md §2.
 */

// ─── Event Types ─────────────────────────────────────────────────────

export type UiEventType =
  | 'EXTRACT_PAGE'           // Request M2 to extract current tab
  | 'EXTRACT_PAGE_RESULT'    // M2 extraction result
  | 'EXTRACT_PAGE_ERROR'     // M2 extraction failed
  | 'ABORT_ALL_GENERATIONS'  // Kill all running LLM streams
  | 'SIDE_PANEL_OPENED'      // Side Panel was opened
  | 'SIDE_PANEL_CLOSED'      // Side Panel was closed
  | 'TAB_ACTIVATED'          // User switched to a different tab
  | 'SHORTCUT_TRIGGERED'     // Global shortcut was pressed
  | 'CONTEXT_CHANGED'        // Current context updated
  | 'THEME_CHANGED'          // Theme toggled (light/dark)
  | 'SETTINGS_CHANGED'       // Settings were updated
  | 'NAVIGATE';              // Navigate to a different route

/** Runtime array of all UiEventType values (for Object.values-like iteration). */
export const UI_EVENT_TYPES: UiEventType[] = [
  'EXTRACT_PAGE',
  'EXTRACT_PAGE_RESULT',
  'EXTRACT_PAGE_ERROR',
  'ABORT_ALL_GENERATIONS',
  'SIDE_PANEL_OPENED',
  'SIDE_PANEL_CLOSED',
  'TAB_ACTIVATED',
  'SHORTCUT_TRIGGERED',
  'CONTEXT_CHANGED',
  'THEME_CHANGED',
  'SETTINGS_CHANGED',
  'NAVIGATE',
];

export interface UiEvent {
  type: UiEventType;
  payload?: unknown;
  timestamp: number;
  source: 'popup' | 'sidepanel' | 'background' | 'options' | 'content-script';
}

// ─── Listener ────────────────────────────────────────────────────────

export type UiEventListener = (event: UiEvent) => void;

// ─── Bus ─────────────────────────────────────────────────────────────

class UiEventBus {
  private listeners = new Map<UiEventType, Set<UiEventListener>>();

  /** Subscribe to a specific event type. Returns unsubscribe function. */
  on(type: UiEventType, listener: UiEventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  /** Subscribe to all events. */
  onAny(listener: UiEventListener): () => void {
    const unsubs: (() => void)[] = [];
    for (const type of UI_EVENT_TYPES) {
      unsubs.push(this.on(type, listener));
    }
    return () => unsubs.forEach((fn) => fn());
  }

  /** Emit an event to all listeners of that type. */
  emit(type: UiEventType, payload?: unknown, source: UiEvent['source'] = 'background'): void {
    const listeners = this.listeners.get(type);
    if (!listeners || listeners.size === 0) return;

    const event: UiEvent = {
      type,
      payload,
      timestamp: Date.now(),
      source,
    };

    for (const listener of listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${type}":`, err);
      }
    }
  }

  /** Remove all listeners. */
  clear(): void {
    this.listeners.clear();
  }
}

export const uiEventBus = new UiEventBus();
