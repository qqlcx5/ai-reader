/**
 * Conversation Branching
 *
 * Implements the "Continue with this model" feature:
 * User clicks a model card's "以此继续" button → creates a new
 * conversation branch using only that model's response as context.
 *
 * Based on design-04-workspace.md §7.
 */

import type {
  Conversation,
  Message,
  ConversationBranch,
  ConversationMode,
} from './types';
import { generateId } from './types';

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Create a branch conversation from a model response.
 *
 * The new conversation inherits the context chain from the original
 * but continues with only the selected model provider.
 */
export function createBranchConversation(
  parentConversation: Conversation,
  parentMessage: Message,
  sourceProviderId: string,
): { conversation: Conversation; branch: ConversationBranch } {
  const branchId = generateId('branch');
  const conversationId = generateId('conv');

  const branch: ConversationBranch = {
    branchId,
    parentConversationId: parentConversation.id,
    parentMessageId: parentMessage.id,
    sourceProviderId,
    sourceModelResponseId: `${parentMessage.id}_${sourceProviderId}`,
  };

  const conversation: Conversation = {
    id: conversationId,
    title: `${parentConversation.title} - ${sourceProviderId}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rootMessageId: parentMessage.id,
    activeProviderIds: [sourceProviderId],
    mode: 'chat',
  };

  return { conversation, branch };
}

/**
 * Get the context chain for a branched conversation.
 * Walks up the parent chain to build full history.
 */
export function getBranchContextChain(
  currentMessage: Message,
  allMessages: Message[],
): Message[] {
  const chain: Message[] = [];
  let current: Message | undefined = currentMessage;

  while (current) {
    chain.unshift(current);
    if (!current.parentId) break;
    current = allMessages.find((m) => m.id === current!.parentId);
  }

  return chain;
}

/**
 * Build chat messages array from a context chain, suitable for
 * sending to the provider.
 */
export function buildBranchMessages(
  chain: Message[],
  newUserContent: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of chain) {
    if (msg.role === 'user' && msg.content) {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      // Only include the source provider's response
      const sourceResponse = msg.modelResponses.find(
        (r) => r.providerId === chain[chain.length - 1]?.modelResponses?.[0]?.providerId,
      );
      if (sourceResponse?.content) {
        messages.push({ role: 'assistant', content: sourceResponse.content });
      }
    }
  }

  messages.push({ role: 'user', content: newUserContent });
  return messages;
}

/**
 * Check if a conversation has branched descendants.
 */
export function hasBranchDescendants(
  conversationId: string,
  branches: ConversationBranch[],
): boolean {
  return branches.some((b) => b.parentConversationId === conversationId);
}

/**
 * Get all branches originating from a conversation.
 */
export function getBranchesForConversation(
  conversationId: string,
  branches: ConversationBranch[],
): ConversationBranch[] {
  return branches.filter((b) => b.parentConversationId === conversationId);
}
