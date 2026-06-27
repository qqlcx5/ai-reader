// ============================================================
// IndexedDB Schema — SuperBrain
// Using Dexie.js
// ============================================================

import Dexie, { type Table } from 'dexie';
import type { SavedArticle } from '../shared/domain';

export interface ChatMessage {
  id?: number;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string; // ISO 8601
}

export interface ChatSession {
  id: string; // UUID
  articleId: string;
  providerId: string;
  providerName: string;
  modelName: string;
  workflow: string; // WorkflowType
  systemPrompt: string;
  title?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface ModelConfig {
  id?: number;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  isDefault: boolean;
  createdAt: string;
}

export interface AppSettingsRow {
  key: string;
  value: unknown;
}

export class SuperBrainDB extends Dexie {
  articles!: Table<SavedArticle, string>;
  chats!: Table<ChatMessage, number>;
  chatSessions!: Table<ChatSession, string>;
  modelConfigs!: Table<ModelConfig, number>;
  settings!: Table<AppSettingsRow, string>;

  constructor() {
    super('SuperBrainDB');

    this.version(1).stores({
      articles: 'id, url, createdAt, siteName, author',
      chats: '++id, sessionId, createdAt',
      chatSessions: 'id, articleId, createdAt',
      modelConfigs: '++id, name, provider',
      settings: 'key',
    });
  }
}

export const db = new SuperBrainDB();
