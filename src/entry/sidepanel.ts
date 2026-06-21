/**
 * M1 Entry & Layout — Side Panel Entry
 *
 * The main workspace of ai-reader. Hosts the context status bar,
 * chat workspace (M4), and input composer.
 *
 * Based on design-01-entry-layout.md §4.2.
 */

import { uiEventBus } from './event-bus';
import { AppRoute } from './routes';
import type { UiEvent } from './event-bus';

// ─── State ───────────────────────────────────────────────────────────

export interface SidePanelState {
  activeRoute: AppRoute;
  currentContext: SidePanelContext | null;
  theme: 'light' | 'dark' | 'system';
  shortcutEnabled: boolean;
}

export interface SidePanelContext {
  tabId: number;
  url: string;
  title: string;
  wordCount: number;
  extractedAt: number;
  status: 'idle' | 'extracting' | 'ready' | 'error';
  errorMessage?: string;
}

const sidePanelState: SidePanelState = {
  activeRoute: AppRoute.Home,
  currentContext: null,
  theme: 'system',
  shortcutEnabled: true,
};

// ─── Init ────────────────────────────────────────────────────────────

export async function initSidePanel(): Promise<SidePanelState> {
  // Restore persisted context from M7 (storage or session)
  await restoreContext();

  // Subscribe to cross-entry events
  setupEventListeners();

  // Listen for runtime messages (including CLOSE_SIDE_PANEL)
  setupMessageListeners();

  return sidePanelState;
}

// ─── Route Navigation ────────────────────────────────────────────────

export function navigateTo(route: AppRoute, params?: Record<string, string>): void {
  sidePanelState.activeRoute = route;
  notifyStateChange();
  uiEventBus.emit('NAVIGATE', { route, params }, 'sidepanel');
}

export function getActiveRoute(): AppRoute {
  return sidePanelState.activeRoute;
}

// ─── Context Management ──────────────────────────────────────────────

export function getCurrentContext(): Readonly<SidePanelContext> | null {
  return sidePanelState.currentContext;
}

export function refreshExtraction(): void {
  if (sidePanelState.currentContext) {
    uiEventBus.emit('EXTRACT_PAGE', { tabId: sidePanelState.currentContext.tabId }, 'sidepanel');
  }
}

export function clearContext(): void {
  sidePanelState.currentContext = null;
  notifyStateChange();
}

// ─── Theme ───────────────────────────────────────────────────────────

export function setTheme(theme: 'light' | 'dark' | 'system'): void {
  sidePanelState.theme = theme;
  notifyStateChange();
  uiEventBus.emit('THEME_CHANGED', { theme }, 'sidepanel');

  // Apply to document
  if (typeof document !== 'undefined') {
    const resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.setAttribute('data-theme', resolved);
  }
}

// ─── Close ───────────────────────────────────────────────────────────

export function closeSidePanel(): void {
  uiEventBus.emit('SIDE_PANEL_CLOSED', null, 'sidepanel');
  if (typeof window !== 'undefined') {
    window.close();
  }
}

// ─── Internal ────────────────────────────────────────────────────────

function setupEventListeners(): void {
  uiEventBus.on('CONTEXT_CHANGED', (event: UiEvent) => {
    const ctx = event.payload as {
      tabId: number;
      url: string;
      title: string;
      wordCount: number;
      extractedAt: number;
      status: string;
      errorMessage?: string;
    };
    if (ctx) {
      sidePanelState.currentContext = {
        tabId: ctx.tabId,
        url: ctx.url,
        title: ctx.title,
        wordCount: ctx.wordCount,
        extractedAt: ctx.extractedAt || Date.now(),
        status: ctx.status as SidePanelContext['status'],
        errorMessage: ctx.errorMessage,
      };
      notifyStateChange();
    }
  });

  uiEventBus.on('TAB_ACTIVATED', (event: UiEvent) => {
    // On tab switch, update the current tab reference but don't auto-extract.
    // The user must click the refresh button to extract the new page.
    const ctx = sidePanelState.currentContext;
    if (ctx && event.payload) {
      const { tabId, url } = event.payload as { tabId: number; url?: string };
      ctx.tabId = tabId;
      if (url) ctx.url = url;
      notifyStateChange();
    }
  });

  // Listen for system theme changes
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (sidePanelState.theme === 'system') {
        setTheme('system');
      }
    });
  }
}

function setupMessageListeners(): void {
  if (!chrome.runtime) return;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && typeof msg === 'object' && (msg as Record<string, unknown>).type === 'CLOSE_SIDE_PANEL') {
      closeSidePanel();
    }
  });
}

async function restoreContext(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get('context-store');
    const contextStore = stored['context-store'] as Record<string, unknown> | undefined;
    if (contextStore?.data) {
      const ctx = contextStore.data as Record<string, unknown>;
      sidePanelState.currentContext = {
        tabId: (ctx.tabId as number) ?? 0,
        url: (ctx.url as string) ?? '',
        title: (ctx.title as string) ?? '',
        wordCount: (ctx.wordCount as number) ?? 0,
        extractedAt: (ctx.extractedAt as number) ?? 0,
        status: (ctx.status as SidePanelContext['status']) ?? 'idle',
      };
    }
  } catch {
    // Context not available — start fresh
  }
}

// ─── Reactivity ──────────────────────────────────────────────────────

let stateChangeListener: (() => void) | null = null;

export function onSidePanelStateChange(callback: () => void): void {
  stateChangeListener = callback;
}

function notifyStateChange(): void {
  stateChangeListener?.();
}

export function getSidePanelState(): Readonly<SidePanelState> {
  return sidePanelState;
}
