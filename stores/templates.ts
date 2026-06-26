import { defineStore } from 'pinia';
import { ref, watch, toRaw } from 'vue';
import { browser } from 'wxt/browser';
import { DEFAULT_PROMPTS } from '@/utils/prompts';

export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  isDefault: boolean;
}

const STORAGE_KEY = 'ai-reader-templates';
const MAX_CUSTOM = 20;

function defaultsToTemplates(): PromptTemplate[] {
  return DEFAULT_PROMPTS.map(dp => ({
    id: dp.id,
    name: dp.name,
    prompt: dp.prompt,
    isDefault: true,
  }));
}

export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref<PromptTemplate[]>([]);
  const ready = ref(false);

  async function load() {
    try {
      const data = await browser.storage.local.get(STORAGE_KEY);
      const saved = data[STORAGE_KEY] as PromptTemplate[] | undefined;
      if (saved && saved.length > 0) {
        templates.value = saved;
      } else {
        // Seed with defaults
        templates.value = defaultsToTemplates();
        await save();
      }
    } catch {
      templates.value = defaultsToTemplates();
    }
    ready.value = true;
  }

  async function save() {
    const plain = toRaw(templates.value).map(t => ({ ...toRaw(t) }));
    try {
      await browser.storage.local.set({ [STORAGE_KEY]: plain });
    } catch {
      // Storage not available
    }
  }

  function addTemplate(name: string, prompt: string): PromptTemplate | null {
    if (templates.value.filter(t => !t.isDefault).length >= MAX_CUSTOM) return null;
    const template: PromptTemplate = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name,
      prompt,
      isDefault: false,
    };
    templates.value.push(template);
    return template;
  }

  function updateTemplate(id: string, updates: Partial<Pick<PromptTemplate, 'name' | 'prompt'>>) {
    const idx = templates.value.findIndex(t => t.id === id);
    if (idx < 0) return;
    templates.value[idx] = { ...templates.value[idx], ...updates };
  }

  function removeTemplate(id: string) {
    const idx = templates.value.findIndex(t => t.id === id);
    if (idx < 0) return;
    if (templates.value[idx].isDefault) return; // Can't delete defaults
    templates.value.splice(idx, 1);
  }

  // Auto-save on changes
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  watch(templates, () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(save, 500);
  }, { deep: true });

  // Load on init
  load();

  return {
    templates,
    ready,
    load,
    addTemplate,
    updateTemplate,
    removeTemplate,
  };
});
