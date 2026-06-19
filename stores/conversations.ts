import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const useConversationsStore = defineStore('conversations', () => {
  // Map of providerId -> message history
  const histories = ref<Map<string, Message[]>>(new Map());

  function getHistory(providerId: string): Message[] {
    return histories.value.get(providerId) || [];
  }

  function addMessage(providerId: string, msg: Message) {
    if (!histories.value.has(providerId)) {
      histories.value.set(providerId, []);
    }
    histories.value.get(providerId)!.push(msg);
  }

  function clearHistory(providerId: string) {
    histories.value.delete(providerId);
  }

  function clearAll() {
    histories.value.clear();
  }

  // Build prompt with context (no chunking, just include full history)
  function buildPromptWithContext(providerId: string, articleContent: string, userMessage: string): string {
    const history = getHistory(providerId);

    let prompt = `Article content:\n\n${articleContent}\n\n`;

    if (history.length > 0) {
      prompt += 'Previous conversation:\n';
      for (const msg of history) {
        prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
      }
    }

    prompt += `User: ${userMessage}`;
    return prompt;
  }

  return {
    histories,
    getHistory,
    addMessage,
    clearHistory,
    clearAll,
    buildPromptWithContext,
  };
});
