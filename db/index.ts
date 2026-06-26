import Dexie, { type EntityTable } from 'dexie'
import type { Article } from '@/domain'

// ============================================================
// PageMind — IndexedDB (Dexie) Instance
// ============================================================
// 仅在 Popup 上下文中初始化（Service Worker 无法访问 IndexedDB）

export interface PageMindDB extends Dexie {
  articles: EntityTable<Article, 'id'>
}

export const db = new Dexie('PageMindDB') as PageMindDB

db.version(1).stores({
  articles: 'id, url, createdAt, updatedAt, siteName, title',
})
