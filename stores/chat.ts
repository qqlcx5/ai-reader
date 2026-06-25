/**
 * 聊天状态管理
 * 参考 doc/tasks/foundation.md 章节 4
 * 参考 doc/tasks/chat-with-doc.md 章节 7
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { sendMessage } from '@/shared/messaging/runtime-client';
import { MessageType } from '@/shared/messaging/messages';
import type { ChatMessage } from '@/shared/types';

interface StreamingState {
  documentId: string;
  content: string;
  done: boolean;
  error?: string;
}

export const useChatStore = defineStore('chat', () => {
  const streaming = ref<StreamingState | null>(null);
  const messages = ref<ChatMessage[]>([]);

  async function startChat(documentId: string, question: string, modelId?: string): Promise<void> {
    if (!question.trim()) return;

    // 立即添加用户消息到 UI
    const userMsg: ChatMessage = {
      id: Date.now().toString() + 'u',
      role: 'user',
      content: question,
      createdAt: Date.now(),
    };
    messages.value.push(userMsg);

    // 准备流式 assistant 消息
    const assistantMsg: ChatMessage = {
      id: Date.now().toString() + 'a',
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      pending: true,
    };
    messages.value.push(assistantMsg);

    streaming.value = { documentId, content: '', done: false };

    await sendMessage(MessageType.START_CHAT, { documentId, question, modelId });
  }

  function appendDelta(documentId: string, delta: string): void {
    if (!streaming.value || streaming.value.documentId !== documentId) return;
    streaming.value.content += delta;
    // 同步到 messages
    const last = messages.value[messages.value.length - 1];
    if (last && last.role === 'assistant' && last.pending) {
      last.content += delta;
    }
  }

  function finishStreaming(documentId: string): void {
    if (streaming.value?.documentId === documentId) {
      streaming.value.done = true;
      const last = messages.value[messages.value.length - 1];
      if (last && last.pending) {
        last.pending = false;
      }
      // 保留 streaming 对象几秒以便 UI 显示完成状态
      setTimeout(() => {
        if (streaming.value?.documentId === documentId) {
          streaming.value = null;
        }
      }, 1000);
    }
  }

  async function stopChat(documentId: string): Promise<void> {
    await sendMessage(MessageType.STOP_CHAT, { documentId });
    if (streaming.value?.documentId === documentId) {
      finishStreaming(documentId);
    }
  }

  function clearMessages(): void {
    messages.value = [];
    streaming.value = null;
  }

  return {
    streaming,
    messages,
    startChat,
    appendDelta,
    finishStreaming,
    stopChat,
    clearMessages,
  };
});
