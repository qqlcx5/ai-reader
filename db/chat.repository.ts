// ============================================================
// Chat Repository — ChatSession + ChatMessage CRUD
// Uses IndexedDB via Dexie.js
// ============================================================

import { db } from './schema';
import type { ChatMessage, ChatSession } from './schema';

function generateUUID(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export class ChatRepository {
  // ===============================
  // ChatSession CRUD
  // ===============================

  async createSession(params: {
    articleId: string;
    providerId: string;
    providerName: string;
    modelName: string;
    workflow: string;
    systemPrompt: string;
    title?: string;
  }): Promise<ChatSession> {
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: generateUUID(),
      articleId: params.articleId,
      providerId: params.providerId,
      providerName: params.providerName,
      modelName: params.modelName,
      workflow: params.workflow,
      systemPrompt: params.systemPrompt,
      title: params.title,
      createdAt: now,
      updatedAt: now,
    };
    await db.chatSessions.put(session);
    return session;
  }

  async getSessionByArticleId(articleId: string): Promise<ChatSession | undefined> {
    return db.chatSessions.where('articleId').equals(articleId).reverse().first();
  }

  async getSessionById(id: string): Promise<ChatSession | undefined> {
    return db.chatSessions.get(id);
  }

  async listSessions(): Promise<ChatSession[]> {
    return db.chatSessions.orderBy('createdAt').reverse().toArray();
  }

  async updateSession(id: string, updates: Partial<Pick<ChatSession, 'title' | 'systemPrompt'>>): Promise<void> {
    await db.chatSessions.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  async touchSession(id: string): Promise<void> {
    await db.chatSessions.update(id, { updatedAt: new Date().toISOString() });
  }

  async deleteSession(id: string): Promise<void> {
    await db.chats.where('sessionId').equals(id).delete();
    await db.chatSessions.delete(id);
  }

  async deleteByArticleId(articleId: string): Promise<void> {
    const sessions = await db.chatSessions.where('articleId').equals(articleId).toArray();
    for (const session of sessions) {
      await db.chats.where('sessionId').equals(session.id).delete();
    }
    await db.chatSessions.where('articleId').equals(articleId).delete();
  }

  // ===============================
  // ChatMessage CRUD
  // ===============================

  async saveMessage(message: Omit<ChatMessage, 'id'>): Promise<number> {
    return db.chats.add(message as ChatMessage);
  }

  async getMessagesBySessionId(sessionId: string): Promise<ChatMessage[]> {
    return db.chats.where('sessionId').equals(sessionId).sortBy('createdAt');
  }

  async deleteMessagesBySessionId(sessionId: string): Promise<void> {
    await db.chats.where('sessionId').equals(sessionId).delete();
  }

  async countMessages(sessionId: string): Promise<number> {
    return db.chats.where('sessionId').equals(sessionId).count();
  }

  // ===============================
  // Convenience: full session load
  // ===============================

  async getFullSession(articleId: string): Promise<{ session: ChatSession; messages: ChatMessage[] } | null> {
    const session = await this.getSessionByArticleId(articleId);
    if (!session) return null;
    const messages = await this.getMessagesBySessionId(session.id);
    return { session, messages };
  }
}

export const chatRepo = new ChatRepository();
