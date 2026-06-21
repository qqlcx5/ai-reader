import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { ConversationRecord, MessageRecord } from '@/modules/storage/types';
import { conversationRepo } from '@/modules/storage/repositories/conversation.repo';
import { messageRepo } from '@/modules/storage/repositories/message.repo';

export const useConversationStore = defineStore(
  'conversation',
  () => {
    const currentConversationId = ref<string | undefined>(undefined);
    const currentMessages = ref<MessageRecord[]>([]);
    const isLoading = ref(false);

    async function loadConversation(id: string) {
      currentConversationId.value = id;
      isLoading.value = true;
      try {
        const page = await messageRepo.listByConversationId(id, { limit: 1000 });
        currentMessages.value = page.items;
      } finally {
        isLoading.value = false;
      }
    }

    async function createConversation(seed: Partial<ConversationRecord>) {
      const conversation = await conversationRepo.create({
        title: seed.title || '未命名会话',
        mode: seed.mode || 'chat',
        activeProviderIds: seed.activeProviderIds || [],
        ...seed,
      });
      currentConversationId.value = conversation.id;
      currentMessages.value = [];
      return conversation;
    }

    async function addUserMessage(conversationId: string, content: string) {
      const message = await messageRepo.create({
        conversationId,
        parentId: currentMessages.value[currentMessages.value.length - 1]?.id || undefined,
        role: 'user',
        content,
        modelResponses: [],
      });
      await conversationRepo.update(conversationId, {
        updatedAt: Date.now(),
        messageCount: currentMessages.value.length + 1,
        preview: content.slice(0, 200),
      });
      currentMessages.value.push(message);
      return message;
    }

    async function appendModelResponse(messageId: string, response: { providerId: string; content: string }) {
      await messageRepo.addModelResponse(messageId, {
        providerId: response.providerId,
        content: response.content,
        createdAt: Date.now(),
      });
      const messages = await messageRepo.listByConversationId(currentConversationId.value || '', { limit: 1000 });
      currentMessages.value = messages.items;
    }

    function reset() {
      currentConversationId.value = undefined;
      currentMessages.value = [];
      isLoading.value = false;
    }

    return {
      currentConversationId,
      currentMessages,
      isLoading,
      loadConversation,
      createConversation,
      addUserMessage,
      appendModelResponse,
      reset,
    };
  },
  {
    persist: {
      key: (id: string) => `pinia-${id}`,
      pick: ['currentConversationId'],
    },
  },
);
