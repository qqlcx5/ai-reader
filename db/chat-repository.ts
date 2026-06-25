/**
 * 聊天历史仓库
 * 参考 doc/tasks/chat-with-doc.md 章节 6
 */
import { db } from './dexie';
import type { ChatHistory, ChatMessage } from '@/shared/types';

export function newChatHistoryId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 9);
}

export function newMessageId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 9);
}

export async function putChatHistory(history: ChatHistory): Promise<void> {
  await db.chatHistories.put(history);
}

export async function getChatHistory(id: string): Promise<ChatHistory | undefined> {
  return db.chatHistories.get(id);
}

export async function listChatHistoriesByDoc(
  documentId: string
): Promise<ChatHistory[]> {
  return db.chatHistories
    .where('documentId')
    .equals(documentId)
    .reverse()
    .sortBy('updatedAt');
}

export async function listAllChatHistories(): Promise<ChatHistory[]> {
  return db.chatHistories.orderBy('updatedAt').reverse().toArray();
}

export async function deleteChatHistory(id: string): Promise<void> {
  await db.chatHistories.delete(id);
}

/**
 * 追加消息到历史
 */
export async function appendMessage(
  historyId: string,
  message: ChatMessage
): Promise<void> {
  const history = await db.chatHistories.get(historyId);
  if (!history) return;
  history.messages.push(message);
  history.updatedAt = Date.now();
  await db.chatHistories.put(history);
}

/**
 * 流式追加 delta 到最后一条 assistant 消息
 */
export async function appendDelta(
  historyId: string,
  delta: string
): Promise<void> {
  const history = await db.chatHistories.get(historyId);
  if (!history) return;
  const last = history.messages[history.messages.length - 1];
  if (last && last.role === 'assistant') {
    last.content += delta;
    history.updatedAt = Date.now();
    await db.chatHistories.put(history);
  }
}
