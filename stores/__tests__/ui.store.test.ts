import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUiStore } from '../ui.store';

describe('ui.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes with sensible defaults', () => {
    const ui = useUiStore();
    expect(ui.activePanel).toBe('chat');
    expect(ui.activeRoute).toBe('home');
    expect(ui.sidebarCollapsed).toBe(false);
    expect(ui.showTokenMetrics).toBe(false);
    expect(ui.sidePanelOpen).toBe(false);
    expect(ui.shortcutEnabled).toBe(true);
    expect(ui.theme).toBe('light');
    expect(ui.isDark).toBe(false);
  });

  it('setPanel updates activePanel', () => {
    const ui = useUiStore();
    ui.setPanel('history');
    expect(ui.activePanel).toBe('history');
  });

  it('setRoute updates activeRoute', () => {
    const ui = useUiStore();
    ui.setRoute('settings');
    expect(ui.activeRoute).toBe('settings');
  });

  it('toggleTheme flips between light and dark', () => {
    const ui = useUiStore();
    expect(ui.theme).toBe('light');
    ui.toggleTheme();
    expect(ui.theme).toBe('dark');
    expect(ui.isDark).toBe(true);
    ui.toggleTheme();
    expect(ui.theme).toBe('light');
    expect(ui.isDark).toBe(false);
  });

  it('setTheme updates the value', () => {
    const ui = useUiStore();
    ui.setTheme('dark');
    expect(ui.theme).toBe('dark');
    ui.setTheme('light');
    expect(ui.theme).toBe('light');
  });

  it('setSidePanelOpen updates state', () => {
    const ui = useUiStore();
    ui.setSidePanelOpen(true);
    expect(ui.sidePanelOpen).toBe(true);
  });

  it('setShortcutEnabled updates state', () => {
    const ui = useUiStore();
    ui.setShortcutEnabled(false);
    expect(ui.shortcutEnabled).toBe(false);
  });

  it('selectConversation stores the id', () => {
    const ui = useUiStore();
    ui.selectConversation('c-123');
    expect(ui.selectedConversationId).toBe('c-123');
    ui.selectConversation(undefined);
    expect(ui.selectedConversationId).toBe(undefined);
  });

  it('history search keyword is settable', () => {
    const ui = useUiStore();
    ui.setHistorySearchKeyword('test');
    expect(ui.historySearchKeyword).toBe('test');
  });

  it('reset returns to defaults', () => {
    const ui = useUiStore();
    ui.setPanel('settings');
    ui.selectConversation('abc');
    ui.setHistorySearchKeyword('x');
    ui.setTheme('dark');
    ui.reset();
    expect(ui.activePanel).toBe('chat');
    expect(ui.activeRoute).toBe('home');
    expect(ui.selectedConversationId).toBe(undefined);
    expect(ui.historySearchKeyword).toBe('');
    expect(ui.theme).toBe('light');
  });
});
