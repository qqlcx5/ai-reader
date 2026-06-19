<script lang="ts" setup>
import { computed } from 'vue';
import ModelSlot from './ModelSlot.vue';
import { useComparisonStore } from '@/stores/comparison';
import { useConversationsStore } from '@/stores/conversations';
import { useContentStore } from '@/stores/content';
import { useSettingsStore } from '@/stores/settings';
import { browser } from 'wxt/browser';

const comparison = useComparisonStore();
const conversations = useConversationsStore();
const content = useContentStore();
const settings = useSettingsStore();

const gridClass = computed(() => {
  const n = comparison.slots.length;
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-2';
  return 'grid-cols-2';
});

function handleFollowUp(index: number, message: string) {
  const slot = comparison.slots[index];
  if (!slot || slot.status === 'streaming') return;

  // Save user message to history
  conversations.addMessage(slot.providerId, { role: 'user', content: message });

  // Build prompt with context
  const prompt = conversations.buildPromptWithContext(slot.providerId, content.rawContent, message);

  // Start streaming for this slot
  const config = settings.getProviderConfig(slot.providerId);
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
      // Save assistant message to history
      conversations.addMessage(slot.providerId, { role: 'assistant', content: slot.text });
    } else if (msg.type === 'error') {
      slot.status = 'error';
      slot.error = msg.error;
      slot.port = null;
    }
  });

  port.onDisconnect.addListener(() => {
    if (slot.status === 'streaming') {
      slot.status = 'done';
      slot.port = null;
    }
  });

  port.postMessage({
    action: 'start',
    providerId: slot.providerId,
    config,
    prompt,
  });
}
</script>

<template>
  <div
    v-if="comparison.slots.length > 0"
    class="grid gap-3 p-3"
    :class="gridClass"
  >
    <ModelSlot
      v-for="(slot, i) in comparison.slots"
      :key="slot.providerId"
      :slot="slot"
      :index="i"
      @abort="(idx) => comparison.abortSlot(idx)"
      @followUp="handleFollowUp"
    />
  </div>
</template>
