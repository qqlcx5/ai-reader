<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useDocumentStore } from '@/stores/document.store';
import { useChatStore } from '@/stores/chat.store';
import { useSettingsStore } from '@/stores/settings.store';
import { documentRepository } from '@/core/documents/document.repository';
import { chatRepository } from '@/core/chat/chat.repository';
import { buildPrompt } from '@/core/chat/prompt-builder';
import { MessageType } from '@/shared/messaging/messages';
import { generateId } from '@/shared/utils/id';
import MarkdownRenderer from '@/components/MarkdownRenderer.vue';
import ModelSelector from '@/components/ModelSelector.vue';
import type { ChatMessage } from '@/db/schema';

const documentStore = useDocumentStore();
const chatStore = useChatStore();
const settingsStore = useSettingsStore();

const question = ref('');
const selectedModelId = ref<string | null>(null);
const portRef = ref<chrome.runtime.Port | null>(null);
const currentHistoryId = ref<string | null>(null);
const messagesContainerRef = ref<HTMLElement | null>(null);

onMounted(async () => {
  await settingsStore.loadModels();

  // 尝试从 URL 获取 documentId
  const urlParams = new URLSearchParams(window.location.search);
  const documentId = urlParams.get('documentId');

  if (documentId) {
    const doc = await documentRepository.getById(documentId);
    if (doc) {
      documentStore.setCurrentDocument(doc);
      // 加载历史对话
      const histories = await chatRepository.getByDocumentId(documentId);
      if (histories.length > 0) {
        chatStore.loadMessages(histories[0].messages);
        currentHistoryId.value = histories[0].id;
      }
    }
  } else {
    // 加载最近的文档
    const docs = await documentRepository.getRecent(1);
    if (docs.length > 0) {
      documentStore.setCurrentDocument(docs[0]);
    }
  }

  // 选择默认模型
  if (settingsStore.enabledModels.length > 0 && !selectedModelId.value) {
    selectedModelId.value = settingsStore.enabledModels[0].id;
  }
});

async function handleSend() {
  if (!question.value.trim() || chatStore.status === 'streaming') return;
  if (!documentStore.currentDocument) return;

  const doc = documentStore.currentDocument;
  const q = question.value.trim();
  question.value = '';

  // 添加用户消息
  const userMsg: ChatMessage = {
    role: 'user',
    content: q,
    timestamp: Date.now(),
  };
  chatStore.addMessage(userMsg);

  // 添加空的 assistant 消息用于流式填充
  const assistantMsg: ChatMessage = {
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
  };
  chatStore.addMessage(assistantMsg);
  chatStore.setStatus('streaming');

  await nextTick();
  scrollToBottom();

  // 构建 prompt
  const messages = buildPrompt({
    markdownContent: doc.markdownContent,
    question: q,
    model: settingsStore.models.find((m) => m.id === selectedModelId.value),
    globalSystemPrompt: settingsStore.globalSystemPrompt,
    history: chatStore.messages.slice(0, -2), // 排除当前用户消息和空 assistant 消息
    documentTitle: doc.title,
    documentUrl: doc.url,
  });

  // 建立长连接
  const port = chrome.runtime.connect({ name: 'chat-stream' });
  portRef.value = port;

  port.onMessage.addListener((msg: { type: string; content?: string; error?: string }) => {
    if (msg.type === 'delta') {
      chatStore.appendDelta(msg.content || '');
      scrollToBottom();
    } else if (msg.type === 'done') {
      chatStore.setStatus('idle');
      saveHistory();
      port.disconnect();
    } else if (msg.type === 'error') {
      chatStore.setError(msg.error || 'Unknown error');
      port.disconnect();
    }
  });

  port.onDisconnect.addListener(() => {
    if (chatStore.status === 'streaming') {
      chatStore.setStatus('idle');
    }
    portRef.value = null;
  });

  // 发送请求
  port.postMessage({
    type: MessageType.START_CHAT_STREAM,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    modelId: selectedModelId.value,
    baseUrl: settingsStore.models.find((m) => m.id === selectedModelId.value)?.baseUrl,
    apiKey: settingsStore.models.find((m) => m.id === selectedModelId.value)?.apiKey,
    model: settingsStore.models.find((m) => m.id === selectedModelId.value)?.model,
  });
}

function handleStop() {
  if (portRef.value) {
    portRef.value.disconnect();
    portRef.value = null;
  }
  chatStore.setStatus('idle');
}

async function handleClear() {
  chatStore.clearMessages();
  currentHistoryId.value = null;
}

async function saveHistory() {
  if (!documentStore.currentDocument) return;

  const history = {
    id: currentHistoryId.value || generateId(),
    documentId: documentStore.currentDocument.id,
    modelId: selectedModelId.value || '',
    model: settingsStore.models.find((m) => m.id === selectedModelId.value)?.model || '',
    messages: [...chatStore.messages],
    createdAt: currentHistoryId.value ? (await chatRepository.getById(currentHistoryId.value))?.createdAt || Date.now() : Date.now(),
    updatedAt: Date.now(),
  };

  await chatRepository.put(history);
  currentHistoryId.value = history.id;
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
    }
  });
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Document Summary -->
    <div v-if="documentStore.currentDocument" class="px-4 py-3 border-b border-slate-200 bg-white">
      <h2 class="text-sm font-semibold text-slate-800 truncate">
        {{ documentStore.currentDocument.title }}
      </h2>
      <div class="flex items-center gap-2 mt-1">
        <span class="text-xs text-slate-500 truncate">
          {{ documentStore.currentDocument.url }}
        </span>
        <span v-if="documentStore.currentDocument.wordCount" class="text-xs text-slate-400">
          {{ documentStore.currentDocument.wordCount }} 字
        </span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex-1 flex items-center justify-center text-slate-400 text-sm">
      <div class="text-center">
        <p class="text-3xl mb-3">📚</p>
        <p class="font-medium">捕获网页后即可开始对话</p>
        <p class="text-xs mt-1">点击页面右下角的 📖 按钮捕获</p>
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesContainerRef" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <div
        v-for="(msg, idx) in chatStore.messages"
        :key="idx"
        class="flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[85%]"
          :class="msg.role === 'user'
            ? 'bg-brand-500 text-white px-3 py-2 rounded-lg rounded-br-sm text-sm'
            : 'bg-white border border-slate-200 px-3 py-2 rounded-lg rounded-bl-sm'"
        >
          <MarkdownRenderer v-if="msg.role === 'assistant'" :content="msg.content" />
          <span v-else>{{ msg.content }}</span>
        </div>
      </div>

      <!-- Error state -->
      <div v-if="chatStore.status === 'error'" class="text-center">
        <p class="text-sm text-red-500">{{ chatStore.error }}</p>
        <button class="btn-ghost text-xs mt-1" @click="handleSend">重试</button>
      </div>
    </div>

    <!-- Input Area -->
    <div v-if="documentStore.currentDocument" class="border-t border-slate-200 bg-white p-3">
      <!-- Model Selector -->
      <div class="flex items-center gap-2 mb-2">
        <ModelSelector v-model="selectedModelId" />
        <button
          v-if="chatStore.messages.length > 0"
          class="btn-ghost text-xs"
          @click="handleClear"
        >
          清空
        </button>
      </div>

      <!-- Input -->
      <div class="flex gap-2">
        <textarea
          v-model="question"
          class="input flex-1 resize-none"
          rows="2"
          placeholder="输入问题... (Enter 发送, Shift+Enter 换行)"
          :disabled="chatStore.status === 'streaming'"
          @keydown="handleKeydown"
        />
        <div class="flex flex-col gap-1">
          <button
            v-if="chatStore.status === 'streaming'"
            class="btn-danger text-sm flex-1"
            @click="handleStop"
          >
            停止
          </button>
          <button
            v-else
            class="btn-primary text-sm flex-1"
            :disabled="!question.trim()"
            @click="handleSend"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
