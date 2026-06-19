import type { ProviderSettings } from '@/utils/llm/types';
import type { PromptTemplate } from '@/stores/templates';

export interface ExportableConfig {
  version: 1;
  providers: Record<string, { baseUrl: string; model: string }>; // No API keys
  enabledProviders: string[];
  templates: PromptTemplate[];
  exportedAt: string;
}

export function exportConfig(settings: ProviderSettings, templates: PromptTemplate[]): string {
  const safeProviders: Record<string, { baseUrl: string; model: string }> = {};
  for (const [id, cfg] of Object.entries(settings.providers)) {
    safeProviders[id] = { baseUrl: cfg.baseUrl, model: cfg.model };
  }
  const config: ExportableConfig = {
    version: 1,
    providers: safeProviders,
    enabledProviders: settings.enabledProviders,
    templates: templates.filter(t => !t.isDefault),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(config, null, 2);
}

export function importConfig(json: string): { providers: Record<string, { baseUrl: string; model: string }>; enabledProviders: string[]; templates: PromptTemplate[] } | null {
  try {
    const config = JSON.parse(json);
    if (config.version !== 1) return null;
    if (!config.providers || typeof config.providers !== 'object') return null;
    return {
      providers: config.providers,
      enabledProviders: Array.isArray(config.enabledProviders) ? config.enabledProviders : [],
      templates: Array.isArray(config.templates) ? config.templates : [],
    };
  } catch {
    return null;
  }
}
