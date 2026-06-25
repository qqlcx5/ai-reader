<script lang="ts" setup>
import { ref, watch, nextTick, computed } from 'vue';
import { useChatStore } from '@/stores/chat';
import { useModelsStore } from '@/stores/models';
import MarkdownRender from '@/components/ui/MarkdownRender.vue';
import type { CapturedDocument } from '@/shared/types';
import { sendMessage } from '@/shared/messaging/runtime-client';
import { MessageType } from '@/shared/messaging/messages';

const props = defineProps<{ document: CapturedDocument | null }>();
const chat = useChatStore();
const modelsStore = useModelsStore();
const question = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const selectedModelId = ref<string | undefined>(undefined);

const isStreaming = computed(() => !!(chat.streaming && !chat.streaming.done));
const docId = computed(() => props.document?.id || '');

watch(
  () => props.document,
  async (newDoc) => {
    chat.clearMessages();
    if (newDoc) {
      await modelsStore.loadModels();
      selectedModelId.value = modelsStore.defaultModelId;
    }
  },
  { immediate: true }
);

async function send(): Promise<void> {
  if (!props.document || !question.value.trim() || isStreaming.value) return;
  const q = question.value;
  question.value = '';
  await chat.startChat(props.document.id, q, selectedModelId.value);
  await scrollToBottom();
}

async function stop(): Promise<void> {
  if (props.document) {
    await chat.stopChat(props.document.id);
  }
}

async function scrollToBottom(): Promise<void> {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

function docHostname(doc: CapturedDocument): string {
  try {
    return new URL(doc.url).hostname;
  } catch {
    return doc.url;
  }
}

watch(
  () => chat.messages,
  () => {
    scrollToBottom();
  },
  { deep: true }
);
</script>

<template>
  <div class="chat-page">
    <div v-if="!document" class="empty">
      <div class="empty-icon">💬</div>
      <div>选择一篇文档开始对话</div>
    </div>

    <template v-else>
      <div class="doc-header">
        <div class="doc-title">{{ document.title }}</div>
        <div class="doc-url">{{ document.siteName || docHostname(document) }}</div>
      </div>

      <div ref="messagesContainer" class="messages">
        <div v-if="chat.messages.length === 0" class="welcome">
          对 {{ document.title }} 提问
        </div>
        <div
          v-for="msg in chat.messages"
          :key="msg.id"
          :class="['message', msg.role]"
        >
          <MarkdownRender
            v-if="msg.role === 'assistant' && msg.content"
            :content="msg.content"
          />
          <div v-else class="message-text">{{ msg.content }}</div>
        </div>
      </div>

      <div class="input-bar">
        <select
          v-if="modelsStore.enabledModels.length > 0"
          v-model="selectedModelId"
          class="model-select"
        >
          <option
            v-for="m in modelsStore.enabledModels"
            :key="m.id"
            :value="m.id"
          >
            {{ m.name }}
          </option>
        </select>

        <div class="input-row">
          <textarea
            v-model="question"
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
            rows="1"
            :disabled="isStreaming"
            @keydown.enter.exact.prevent="send"
          />
          <button
            v-if="isStreaming"
            class="stop-btn"
            @click="stop"
          >
            停止
          </button>
          <button
            v-else
            class="send-btn"
            :disabled="!question.trim()"
            @click="send"
          >
            发送
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.doc-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  flex-shrink: 0;
}

.doc-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-url {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.welcome {
  text-align: center;
  color: var(--color-text-secondary);
  padding: 40px 0;
  font-size: 13px;
}

.message {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 10px;
  word-wrap: break-word;
  font-size: 13px;
  line-height: 1.5;
}
.message.user {
  align-self: flex-end;
  background: var(--color-user-msg);
  color: white;
}
.message.assistant {
  align-self: flex-start;
  background: var(--color-assistant-msg);
  color: var(--color-text);
}

.message-text {
  white-space: pre-wrap;
}

.input-bar {
  border-top: 1px solid var(--color-border);
  background: var(--color-bg);
  padding: 8px 12px;
  flex-shrink: 0;
}

.model-select {
  width: 100%;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
  margin-bottom: 6px;
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

textarea {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  min-height: 36px;
  max-height: 100px;
  font-size: 13px;
}
textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}
textarea:disabled {
  opacity: 0.6;
}

.send-btn, .stop-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}
.send-btn {
  background: var(--color-primary);
  color: white;
}
.send-btn:disabled {
  background: var(--color-text-secondary);
  opacity: 0.5;
  cursor: not-allowed;
}
.stop-btn {
  background: #ef4444;
  color: white;
}

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  text-align: center;
}
.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.4;
}
</style>
