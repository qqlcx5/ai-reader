import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ChatMessage } from '@/db/schema';

export type ChatStatus = 'idle' | 'loading' | 'streaming' | 'error';

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([]);
  const status = ref<ChatStatus>('idle');
  const error = ref<string | null>(null);
  const currentModelId = ref<string | null>(null);

  function addMessage(msg: ChatMessage) {
    messages.value.push(msg);
  }

  function appendDelta(content: string) {
    const last = messages.value[messages.value.length - 1];
    if (last && last.role === 'assistant') {
      last.content += content;
    }
  }

  function setStatus(s: ChatStatus) {
    status.value = s;
  }

  function setError(e: string | null) {
    error.value = e;
    if (e) status.value = 'error';
  }

  function clearMessages() {
    messages.value = [];
    status.value = 'idle';
    error.value = null;
  }

  function loadMessages(msgs: ChatMessage[]) {
    messages.value = msgs;
  }

  return {
    messages,
    status,
    error,
    currentModelId,
    addMessage,
    appendDelta,
    setStatus,
    setError,
    clearMessages,
    loadMessages,
  };
});
