/**
 * M1 Entry & Layout — Options Entry
 *
 * Full-page settings UI with tabbed navigation.
 * Tabs: Provider, Prompts, Sync, RSS, Advanced.
 *
 * Based on design-01-entry-layout.md §4.3.
 */

import { uiEventBus } from './event-bus';
import type { Settings, ProviderConfig, PromptTemplate, ExportConfig, RssConfig } from '../storage/types';
import { defaultSettings } from '../storage/types';
import { loadSettings, saveSettings } from '../storage/persisted-state';

// ─── Options Tabs ────────────────────────────────────────────────────

export enum OptionsTab {
  Provider = 'provider',
  Prompts = 'prompts',
  Sync = 'sync',
  RSS = 'rss',
  Advanced = 'advanced',
}

export const OPTIONS_TAB_LABELS: Record<OptionsTab, string> = {
  [OptionsTab.Provider]: 'Providers',
  [OptionsTab.Prompts]: 'Prompts',
  [OptionsTab.Sync]: 'Sync & Export',
  [OptionsTab.RSS]: 'RSS Feeds',
  [OptionsTab.Advanced]: 'Advanced',
};

// ─── State ───────────────────────────────────────────────────────────

export interface OptionsState {
  activeTab: OptionsTab;
  settings: Settings;
  isDirty: boolean;
  isSaving: boolean;
  lastSaveError?: string;
}

const optionsState: OptionsState = {
  activeTab: OptionsTab.Provider,
  settings: { ...defaultSettings },
  isDirty: false,
  isSaving: false,
};

// ─── Init ────────────────────────────────────────────────────────────

export async function initOptions(): Promise<OptionsState> {
  optionsState.settings = await loadSettings();
  notifyStateChange();
  return optionsState;
}

// ─── Tab Navigation ──────────────────────────────────────────────────

export function switchTab(tab: OptionsTab): void {
  optionsState.activeTab = tab;
  notifyStateChange();
}

export function getActiveTab(): OptionsTab {
  return optionsState.activeTab;
}

// ─── Settings Getters/Setters ────────────────────────────────────────

export function getSettings(): Readonly<Settings> {
  return optionsState.settings;
}

export function getProviders(): Readonly<ProviderConfig>[] {
  return optionsState.settings.providers;
}

export function getPrompts(): Readonly<PromptTemplate>[] {
  return optionsState.settings.prompts;
}

export function getExportConfig(): Readonly<ExportConfig> {
  return optionsState.settings.exportConfig;
}

export function getRssConfig(): Readonly<RssConfig> {
  return optionsState.settings.rssConfig;
}

// ─── CRUD Operations ─────────────────────────────────────────────────

export function addProvider(provider: ProviderConfig): void {
  optionsState.settings.providers = [...optionsState.settings.providers, provider];
  optionsState.isDirty = true;
  notifyStateChange();
}

export function updateProvider(id: string, patch: Partial<ProviderConfig>): void {
  optionsState.settings.providers = optionsState.settings.providers.map((p) =>
    p.id === id ? { ...p, ...patch } : p,
  );
  optionsState.isDirty = true;
  notifyStateChange();
}

export function removeProvider(id: string): void {
  optionsState.settings.providers = optionsState.settings.providers.filter((p) => p.id !== id);
  optionsState.isDirty = true;
  notifyStateChange();
}

export function addPrompt(prompt: PromptTemplate): void {
  optionsState.settings.prompts = [...optionsState.settings.prompts, prompt];
  optionsState.isDirty = true;
  notifyStateChange();
}

export function updatePrompt(id: string, patch: Partial<PromptTemplate>): void {
  optionsState.settings.prompts = optionsState.settings.prompts.map((p) =>
    p.id === id ? { ...p, ...patch } : p,
  );
  optionsState.isDirty = true;
  notifyStateChange();
}

export function removePrompt(id: string): void {
  optionsState.settings.prompts = optionsState.settings.prompts.filter((p) => p.id !== id);
  optionsState.isDirty = true;
  notifyStateChange();
}

export function updateExportConfig(patch: Partial<ExportConfig>): void {
  optionsState.settings.exportConfig = { ...optionsState.settings.exportConfig, ...patch };
  optionsState.isDirty = true;
  notifyStateChange();
}

export function updateRssConfig(patch: Partial<RssConfig>): void {
  optionsState.settings.rssConfig = { ...optionsState.settings.rssConfig, ...patch };
  optionsState.isDirty = true;
  notifyStateChange();
}

// ─── Save / Reset ────────────────────────────────────────────────────

export async function saveCurrentSettings(): Promise<void> {
  if (!optionsState.isDirty) return;

  optionsState.isSaving = true;
  optionsState.lastSaveError = undefined;
  notifyStateChange();

  try {
    await saveSettings(optionsState.settings);
    optionsState.isDirty = false;
    uiEventBus.emit('SETTINGS_CHANGED', { settings: optionsState.settings }, 'options');
  } catch (err) {
    optionsState.lastSaveError = err instanceof Error ? err.message : String(err);
  } finally {
    optionsState.isSaving = false;
    notifyStateChange();
  }
}

export async function resetToDefaults(): Promise<void> {
  optionsState.settings = { ...defaultSettings };
  optionsState.isDirty = true;
  notifyStateChange();
}

export async function importSettings(json: string): Promise<void> {
  try {
    const parsed = JSON.parse(json) as Settings;
    // Validate minimally
    if (!parsed.providers || !Array.isArray(parsed.providers)) {
      throw new Error('Invalid settings format: missing providers array');
    }
    optionsState.settings = parsed;
    optionsState.isDirty = true;
    notifyStateChange();
  } catch (err) {
    throw new Error(`Failed to import settings: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function exportSettingsAsJson(): string {
  return JSON.stringify(optionsState.settings, null, 2);
}

// ─── Reactivity ──────────────────────────────────────────────────────

let stateChangeListener: (() => void) | null = null;

export function onOptionsStateChange(callback: () => void): void {
  stateChangeListener = callback;
}

function notifyStateChange(): void {
  stateChangeListener?.();
}

export function getOptionsState(): Readonly<OptionsState> {
  return optionsState;
}
