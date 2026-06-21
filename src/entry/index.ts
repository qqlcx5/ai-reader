/**
 * M1 Entry & Layout — Unified Export
 *
 * Provides entry points, routing, event bus, commands, and state
 * management for the three extension entry points:
 * - Popup (lightweight icon click)
 * - Side Panel (core workspace)
 * - Options (settings page)
 *
 * Based on design-01-entry-layout.md.
 */

// ─── Routes ──────────────────────────────────────────────────────────

export { AppRoute, ROUTE_LABELS } from './routes';
export type { RouteMeta } from './routes';

// ─── Event Bus ───────────────────────────────────────────────────────

export { uiEventBus } from './event-bus';
export type { UiEvent, UiEventType, UiEventListener } from './event-bus';

// ─── Commands ────────────────────────────────────────────────────────

export {
  COMMANDS,
  registerCommands,
  getCommandShortcut,
  openShortcutSettings,
} from './commands';
export type { CommandName } from './commands';

// ─── Background ──────────────────────────────────────────────────────

export {
  initBackground,
  openSidePanel,
  closeSidePanel,
} from './background';

// ─── Popup ───────────────────────────────────────────────────────────

export {
  initPopup,
  openSidePanelFromPopup,
  extractCurrentPage,
  openOptionsPage,
  closePopup,
  onPopupStateChange,
  getPopupState,
} from './popup';
export type { PopupState } from './popup';

// ─── Side Panel ──────────────────────────────────────────────────────

export {
  initSidePanel,
  navigateTo,
  getActiveRoute,
  getCurrentContext,
  refreshExtraction,
  clearContext,
  setTheme,
  closeSidePanel,
  onSidePanelStateChange,
  getSidePanelState,
} from './sidepanel';
export type { SidePanelState, SidePanelContext } from './sidepanel';

// ─── Options ─────────────────────────────────────────────────────────

export {
  OptionsTab,
  OPTIONS_TAB_LABELS,
  initOptions,
  switchTab,
  getActiveTab,
  getSettings,
  getProviders,
  getPrompts,
  getExportConfig,
  getRssConfig,
  addProvider,
  updateProvider,
  removeProvider,
  addPrompt,
  updatePrompt,
  removePrompt,
  updateExportConfig,
  updateRssConfig,
  saveCurrentSettings,
  resetToDefaults,
  importSettings,
  exportSettingsAsJson,
  onOptionsStateChange,
  getOptionsState,
} from './options';
export type { OptionsState } from './options';
