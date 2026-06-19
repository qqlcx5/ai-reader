import { defineStore } from 'pinia';
import { ref } from 'vue';
import { browser } from 'wxt/browser';
import type { ProviderConfig } from '@/utils/llm/types';
import { useSettingsStore } from './settings';
import { useHistoryStore } from './history';
import { useContentStore } from './content';

export interface StreamSlot {
  providerId: string;
  modelId: string;
  status: 'idle' | 'streaming' | 'done' | 'error';
  text: string;
  error: string;
  port: any | null;
  startTime: number;
  endTime: number;
  tokenCount: number;
  lastPrompt: string;
}

export const useComparisonStore = defineStore('comparison', () => {
  const slots = ref<StreamSlot[]>([]);
  const isRunning = ref(false);

  function initSlots(providerIds: string[]) {
    abortAll();

    const settings = useSettingsStore();
    slots.value = providerIds.map((id) => ({
      providerId: id,
      modelId: settings.getProviderConfig(id).model,
      status: 'idle' as const,
      text: '',
      error: '',
      port: null,
      startTime: 0,
      endTime: 0,
      tokenCount: 0,
      lastPrompt: '',
    }));
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

      slot.status = 'streaming';
      slot.text = '';
      slot.error = '';
      slot.startTime = Date.now();
      slot.endTime = 0;
      slot.tokenCount = 0;
      slot.lastPrompt = prompt;

      const port = browser.runtime.connect({ name: 'llm-stream' });
      slot.port = port;

      port.onMessage.addListener((msg) => {
        if (msg.type === 'delta') {
          slot.text += msg.text;
          slot.tokenCount++;
        } else if (msg.type === 'done') {
          slot.status = 'done';
          slot.endTime = Date.now();
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
  }

  function retrySlot(index: number) {
    const slot = slots.value[index];
    if (!slot || slot.status === 'streaming' || !slot.lastPrompt) return;

    const settings = useSettingsStore();
    const config = settings.getProviderConfig(slot.providerId);

    slot.status = 'streaming';
    slot.text = '';
    slot.error = '';
    slot.startTime = Date.now();
    slot.endTime = 0;
    slot.tokenCount = 0;

    const port = browser.runtime.connect({ name: 'llm-stream' });
    slot.port = port;

    port.onMessage.addListener((msg) => {
      if (msg.type === 'delta') {
        slot.text += msg.text;
        slot.tokenCount++;
      } else if (msg.type === 'done') {
        slot.status = 'done';
        slot.endTime = Date.now();
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
      prompt: slot.lastPrompt,
    });
  }

  function abortSlot(index: number) {
    const slot = slots.value[index];
    if (slot?.port) {
      slot.port.disconnect();
      slot.port = null;
      slot.status = 'done';
      slot.endTime = Date.now();
    }
  }

  function abortAll() {
    for (const slot of slots.value) {
      if (slot.port) {
        slot.port.disconnect();
        slot.port = null;
      }
    }
    isRunning.value = false;
  }

  function checkAllDone() {
    if (slots.value.every((s) => s.status !== 'streaming')) {
      isRunning.value = false;
      // Save to history if there are completed summaries
      const completedTexts = slots.value.filter(s => s.text).map(s => s.text);
      if (completedTexts.length > 0) {
        const content = useContentStore();
        const history = useHistoryStore();
        history.addEntry({
          title: content.title || 'Untitled',
          url: content.url || '',
          summary: completedTexts[0].slice(0, 200),
        });
      }
    }
  }

  function followUpSlot(index: number, prompt: string) {
    const slot = slots.value[index];
    if (!slot || slot.status === 'streaming') return;

    const settings = useSettingsStore();
    const config = settings.getProviderConfig(slot.providerId);

    slot.status = 'streaming';
    slot.text = '';
    slot.error = '';
    slot.startTime = Date.now();
    slot.endTime = 0;
    slot.tokenCount = 0;
    slot.lastPrompt = prompt;

    const port = browser.runtime.connect({ name: 'llm-stream' });
    slot.port = port;

    port.onMessage.addListener((msg) => {
      if (msg.type === 'delta') {
        slot.text += msg.text;
        slot.tokenCount++;
      } else if (msg.type === 'done') {
        slot.status = 'done';
        slot.endTime = Date.now();
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
