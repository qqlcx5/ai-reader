import { defineStore } from 'pinia';
import { ref } from 'vue';
import { estimateTokens } from '@/utils/cost';

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
  function buildPromptWithContext(
    providerId: string,
    articleContent: string,
    userMessage: string,
    maxTokens: number = 4000,
  ): string {
    const history = getHistory(providerId);

    let prompt = `Article content:\n\n${articleContent}\n\n`;

    if (history.length > 0) {
      prompt += 'Previous conversation:\n';
      for (const msg of history) {
        prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
      }
    }

    prompt += `User: ${userMessage}`;

    // Check token budget
    let totalTokens = estimateTokens(prompt);
    if (totalTokens <= maxTokens) return prompt;

    // Truncate article content first
    const articlePrefix = `Article content:\n\n`;
    const articleSuffix = `\n\n`;
    const articleStart = prompt.indexOf(articlePrefix) + articlePrefix.length;
    const articleEnd = prompt.indexOf(articleSuffix, articleStart);
    const articleSection = prompt.slice(articleStart, articleEnd);

    const overage = totalTokens - maxTokens;
    // Estimate chars to remove (rough: ~2 chars per token for mixed content)
    const charsToRemove = Math.min(overage * 2, articleSection.length - 100);
    if (charsToRemove > 0) {
      const truncated = articleSection.slice(0, articleSection.length - charsToRemove) + '...';
      prompt = prompt.slice(0, articleStart) + truncated + prompt.slice(articleEnd);
      totalTokens = estimateTokens(prompt);
    }

    // If still over budget, drop oldest conversation turns (keep userMessage)
    const userMessagePrefix = `\nUser: ${userMessage}`;
    if (totalTokens > maxTokens && history.length > 0) {
      const historyStart = prompt.indexOf('Previous conversation:\n');
      if (historyStart >= 0) {
        const turns: string[] = [];
        for (const msg of history) {
          turns.push(`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`);
        }
        // Drop oldest turns until under budget
        let kept = turns.slice();
        while (kept.length > 1 && estimateTokens(prompt) > maxTokens) {
          kept.shift();
          prompt =
            prompt.slice(0, historyStart) +
            'Previous conversation:\n' +
            kept.join('') +
            `User: ${userMessage}`;
        }
      }
    }

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
