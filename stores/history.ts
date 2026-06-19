import { defineStore } from 'pinia';
import { ref } from 'vue';
import { browser } from 'wxt/browser';

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  timestamp: number;
  summary: string;
}

const STORAGE_KEY = 'ai-reader-history';
const MAX_ENTRIES = 50;

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([]);
  const ready = ref(false);

  async function load() {
    const data = await browser.storage.local.get(STORAGE_KEY);
    entries.value = (data[STORAGE_KEY] as HistoryEntry[]) || [];
    ready.value = true;
  }

  async function addEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
    const newEntry: HistoryEntry = {
      ...entry,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      timestamp: Date.now(),
    };
    entries.value.unshift(newEntry);
    if (entries.value.length > MAX_ENTRIES) {
      entries.value = entries.value.slice(0, MAX_ENTRIES);
    }
    await save();
  }

  async function removeEntry(id: string) {
    entries.value = entries.value.filter(e => e.id !== id);
    await save();
  }

  async function clear() {
    entries.value = [];
    await save();
  }

  async function save() {
    await browser.storage.local.set({ [STORAGE_KEY]: entries.value });
  }

  // Load on init
  load();

  return { entries, ready, load, addEntry, removeEntry, clear };
});
