/**
 * 文档仓库
 * 参考 doc/tasks/persistence.md 章节 1
 * 参考 doc/tasks/perception.md 章节 4
 */
import { db, SCHEMA_VERSION } from './dexie';
import type { CapturedDocument } from '@/shared/types';

/**
 * 生成文档 ID
 */
export function newDocumentId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 9);
}

/**
 * 创建或更新文档
 */
export async function putDocument(doc: CapturedDocument): Promise<void> {
  await db.documents.put(doc);
}

/**
 * 批量写入
 */
export async function bulkPutDocuments(docs: CapturedDocument[]): Promise<void> {
  await db.documents.bulkPut(docs);
}

/**
 * 获取单个文档
 */
export async function getDocument(id: string): Promise<CapturedDocument | undefined> {
  return db.documents.get(id);
}

/**
 * 获取所有文档（按创建时间倒序）
 */
export async function listDocuments(
  limit = 50,
  offset = 0
): Promise<{ documents: CapturedDocument[]; total: number }> {
  const total = await db.documents.count();
  const documents = await db.documents
    .orderBy('createdAt')
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();
  return { documents, total };
}

/**
 * 通过 URL 查询
 */
export async function getDocumentByUrl(url: string): Promise<CapturedDocument | undefined> {
  return db.documents.where('url').equals(url).first();
}

/**
 * 删除文档
 */
export async function deleteDocument(id: string): Promise<void> {
  await db.documents.delete(id);
  // 同步删除关联的聊天历史
  await db.chatHistories.where('documentId').equals(id).delete();
}

/**
 * 清空所有文档
 */
export async function clearDocuments(): Promise<void> {
  await db.documents.clear();
  await db.chatHistories.clear();
}

/**
 * 导出所有文档（带 schemaVersion）
 */
export async function exportAll(): Promise<CapturedDocument[]> {
  return db.documents.toArray();
}
