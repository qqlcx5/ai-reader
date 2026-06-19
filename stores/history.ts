import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { browser } from 'wxt/browser';
import { compress, decompress } from '@/utils/compress';

export interface ModelResponseSnapshot {
  providerId: string;
  modelId: string;
  text: string;
  status: 'done' | 'error';
  error?: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  elapsedMs: number;
}

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  timestamp: number;
  /** The first model response text — kept at top level for list previews. */
  summary: string;
  /** The prompt that was sent to all models. */
  prompt: string;
  /** Article word count at time of capture. */
  wordCount: number;
  /** Whether this entry is favorited. */
  favorite: boolean;
  /** Full per-model responses. */
  responses: ModelResponseSnapshot[];
}

const STORAGE_KEY = 'ai-reader-history';
const MAX_ENTRIES = 50;

interface PersistedEnvelope {
  v: 2;
  /** base64-lz-string-compressed JSON of HistoryEntry[] */
  data: string;
}

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([]);
  const ready = ref(false);
  const totalCost = computed(() =>
    entries.value.reduce((sum, e) => sum + e.responses.reduce((s, r) => s + r.estimatedCost, 0), 0)
  );

  async function load() {
    try {
      const data = await browser.storage.local.get(STORAGE_KEY);
      const raw = data[STORAGE_KEY];
      if (!raw) {
        entries.value = [];
      } else if (typeof raw === 'object' && 'v' in raw && (raw as PersistedEnvelope).v === 2) {
        // New compressed format
        const envelope = raw as PersistedEnvelope;
        try {
          const json = decompress(envelope.data);
          entries.value = JSON.parse(json) as HistoryEntry[];
        } catch (e) {
          console.error('Failed to decompress history:', e);
          entries.value = [];
        }
      } else if (Array.isArray(raw)) {
        // Legacy plain array
        entries.value = raw as HistoryEntry[];
      } else {
        entries.value = [];
      }
    } catch (e) {
      console.error('Failed to load history:', e);
      entries.value = [];
    }
    ready.value = true;
  }

  async function addEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp' | 'summary' | 'favorite'>) {
    const summary = entry.responses.find((r) => r.status === 'done')?.text
      || entry.responses[0]?.text
      || '';
    const newEntry: HistoryEntry = {
      ...entry,
      summary: summary.slice(0, 280),
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      favorite: false,
    };
    entries.value.unshift(newEntry);
    if (entries.value.length > MAX_ENTRIES) {
      entries.value = entries.value.slice(0, MAX_ENTRIES);
    }
    await save();
  }

  async function removeEntry(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id);
    await save();
  }

  async function clear() {
    entries.value = [];
    await save();
  }

  async function save() {
    try {
      const json = JSON.stringify(entries.value);
      const compressed = compress(json);
      const envelope: PersistedEnvelope = { v: 2, data: compressed };
      await browser.storage.local.set({ [STORAGE_KEY]: envelope });
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }

  function getEntry(id: string): HistoryEntry | undefined {
    return entries.value.find((e) => e.id === id);
  }

  async function toggleFavorite(id: string) {
    const entry = entries.value.find((e) => e.id === id);
    if (entry) {
      entry.favorite = !entry.favorite;
      await save();
    }
  }

  // Load on init
  load();

  return { entries, ready, totalCost, load, addEntry, removeEntry, clear, getEntry, toggleFavorite };
});
