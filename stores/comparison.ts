import { defineStore } from 'pinia';
import { ref } from 'vue';
import { browser } from 'wxt/browser';
import type { ProviderConfig } from '@/utils/llm/types';
import { useSettingsStore } from './settings';

export interface StreamSlot {
  providerId: string;
  modelId: string;
  status: 'idle' | 'streaming' | 'done' | 'error';
  text: string;
  error: string;
  port: chrome.runtime.Port | null;
}

export const useComparisonStore = defineStore('comparison', () => {
  const slots = ref<StreamSlot[]>([]);
  const isRunning = ref(false);

  function initSlots(providerIds: string[]) {
    // Abort existing streams
    abortAll();

    const settings = useSettingsStore();
    slots.value = providerIds.map((id) => ({
      providerId: id,
      modelId: settings.getProviderConfig(id).model,
      status: 'idle' as const,
      text: '',
      error: '',
      port: null,
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

      const port = browser.runtime.connect({ name: 'llm-stream' });
      slot.port = port;

      port.onMessage.addListener((msg) => {
        if (msg.type === 'delta') {
          slot.text += msg.text;
        } else if (msg.type === 'done') {
          slot.status = 'done';
          slot.port = null;
          checkAllDone();
        } else if (msg.type === 'error') {
          slot.status = 'error';
          slot.error = msg.error;
          slot.port = null;
          checkAllDone();
        }
      });

      port.onDisconnect.addListener(() => {
        if (slot.status === 'streaming') {
          slot.status = 'done';
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

  function abortSlot(index: number) {
    const slot = slots.value[index];
    if (slot?.port) {
      slot.port.disconnect();
      slot.port = null;
      slot.status = 'done';
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
    }
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
    abortSlot,
    abortAll,
    clearAll,
  };
});
