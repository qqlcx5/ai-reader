import { defineStore } from 'pinia';
import { ref } from 'vue';
import { browser } from 'wxt/browser';
import type { ProviderConfig, StreamError } from '@/utils/llm/types';
import { estimateTokens, estimateCost } from '@/utils/cost';
import { useSettingsStore } from './settings';
import { useHistoryStore, type ModelResponseSnapshot } from './history';
import { useContentStore } from './content';

export interface StreamSlot {
  providerId: string;
  modelId: string;
  status: 'idle' | 'streaming' | 'done' | 'error';
  text: string;
  error: StreamError | string;
  port: any | null;
  startTime: number;
  endTime: number;
  tokenCount: number;
  lastPrompt: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export const useComparisonStore = defineStore('comparison', () => {
  const slots = ref<StreamSlot[]>([]);
  const isRunning = ref(false);

  function initSlots(providerIds: string[]) {
    // Cancel any in-flight streams first
    abortAll();

    const settings = useSettingsStore();
    const fresh: StreamSlot[] = providerIds.map((id) => {
      const config = settings.getProviderConfig(id);
      return {
        providerId: id,
        modelId: config.model,
        status: 'idle' as const,
        text: '',
        error: '',
        port: null,
        startTime: 0,
        endTime: 0,
        tokenCount: 0,
        lastPrompt: '',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0,
      };
    });
    slots.value = fresh;
    isRunning.value = false;
  }

  function connectSlot(slot: StreamSlot, config: ProviderConfig, prompt: string) {
    slot.status = 'streaming';
    slot.text = '';
    slot.error = '';
    slot.startTime = Date.now();
    slot.endTime = 0;
    slot.tokenCount = 0;
    slot.inputTokens = estimateTokens(prompt);
    slot.outputTokens = 0;
    slot.estimatedCost = 0;

    const port = browser.runtime.connect({ name: 'llm-stream' });
    slot.port = port;

    port.onMessage.addListener((msg) => {
      if (msg.type === 'delta') {
        slot.text += msg.text;
        slot.tokenCount++;
        slot.outputTokens = estimateTokens(slot.text);
      } else if (msg.type === 'done') {
        slot.status = 'done';
        slot.endTime = Date.now();
        slot.estimatedCost = estimateCost(slot.modelId, slot.inputTokens, slot.outputTokens);
        slot.port = null;
        checkAllDone();
      } else if (msg.type === 'error') {
        slot.status = 'error';
        slot.error = msg.error;
        slot.endTime = Date.now();
        slot.port = null;
        checkAllDone();
      }
    });

    port.onDisconnect.addListener(() => {
      if (slot.status === 'streaming') {
        slot.status = 'error';
        slot.error = 'Connection lost';
        slot.endTime = Date.now();
        slot.port = null;
        checkAllDone();
      }
    });

    port.postMessage({
      action: 'start',
      providerId: slot.providerId,
      config,
      prompt,
    });
  }

  function startAll(prompt: string) {
    const settings = useSettingsStore();
    isRunning.value = true;

    for (const slot of slots.value) {
      const config = settings.getProviderConfig(slot.providerId);
      if (!config.apiKey && slot.providerId !== 'ollama') {
        slot.status = 'error';
        slot.error = 'No API key configured';
        continue;
      }

      slot.lastPrompt = prompt;
      connectSlot(slot, config, prompt);
    }
  }

  function retrySlot(index: number) {
    const slot = slots.value[index];
    if (!slot || slot.status === 'streaming' || !slot.lastPrompt) return;

    const settings = useSettingsStore();
    const config = settings.getProviderConfig(slot.providerId);
    connectSlot(slot, config, slot.lastPrompt);
  }

  function abortSlot(index: number) {
    const slot = slots.value[index];
    if (slot?.port) {
      slot.port.disconnect();
      slot.port = null;
      slot.status = 'done';
      slot.endTime = Date.now();
    }
    checkAllDone();
  }

  function abortAll() {
    for (const slot of slots.value) {
      if (slot.port) {
        try { slot.port.disconnect(); } catch {}
        slot.port = null;
      }
    }
    isRunning.value = false;
  }

  function checkAllDone() {
    if (slots.value.length === 0) {
      isRunning.value = false;
      return;
    }
    const stillRunning = slots.value.some((s) => s.status === 'streaming');
    if (stillRunning) {
      isRunning.value = true;
      return;
    }
    isRunning.value = false;

    // Save to history when at least one slot finished
    const completed = slots.value.filter((s) => s.text && (s.status === 'done' || s.status === 'error'));
    if (completed.length === 0) return;

    const content = useContentStore();
    const history = useHistoryStore();
    const responses: ModelResponseSnapshot[] = completed.map((s) => ({
      providerId: s.providerId,
      modelId: s.modelId,
      text: s.text,
      status: s.status as 'done' | 'error',
      error: typeof s.error === 'string' ? s.error : (s.error?.message ?? ''),
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
      estimatedCost: s.estimatedCost,
      elapsedMs: s.endTime > 0 ? s.endTime - s.startTime : 0,
    }));

    // Persist the first prompt (full slot prompt) — callers pass the same prompt to all
    const firstPrompt = completed[0]?.lastPrompt ?? '';

    history.addEntry({
      title: content.title || 'Untitled',
      url: content.url || '',
      wordCount: content.wordCount,
      prompt: firstPrompt,
      responses,
    });
  }

  function followUpSlot(index: number, prompt: string) {
    const slot = slots.value[index];
    if (!slot || slot.status === 'streaming') return;

    const settings = useSettingsStore();
    const config = settings.getProviderConfig(slot.providerId);
    slot.lastPrompt = prompt;
    connectSlot(slot, config, prompt);
  }

  function clearAll() {
    abortAll();
    slots.value = [];
  }

  return {
    slots,
    isRunning,
    initSlots,
    startAll,
    retrySlot,
    followUpSlot,
    abortSlot,
    abortAll,
    clearAll,
  };
});
