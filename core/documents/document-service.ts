/**
 * 文档服务 - 协调捕获、存储、索引
 * 参考 doc/tasks/perception.md 章节 5, 6, 7
 */
import type { CapturedDocument, ContentCapturePayload } from '@/shared/types';
import {
  newDocumentId,
  putDocument,
  getDocument,
  listDocuments,
  deleteDocument,
} from '@/db/document-repository';
import { notifyIndexUpdate, notifyIndexRemove } from '@/core/search/index-coordinator';
import { LZString } from '@/shared/utils/lz-string';

/**
 * 存储捕获结果
 * 返回新创建的文档 ID
 */
export async function saveCapturedDocument(
  payload: ContentCapturePayload
): Promise<string> {
  const now = Date.now();
  const id = newDocumentId();
  const doc: CapturedDocument = {
    id,
    url: payload.url,
    title: payload.title,
    markdownContent: payload.markdownContent,
    author: payload.metadata.author,
    description: payload.metadata.description,
    keywords: payload.metadata.keywords,
    siteName: payload.metadata.siteName,
    image: payload.metadata.image,
    favicon: payload.metadata.favicon,
    language: payload.metadata.language,
    wordCount: payload.metadata.wordCount,
    schemaOrgData: payload.metadata.schemaOrgData,
    publishedAt: payload.metadata.publishedAt,
    createdAt: now,
    updatedAt: now,
  };

  await putDocument(doc);
  // 通知搜索索引更新
  await notifyIndexUpdate(id);
  return id;
}

/**
 * 获取文档（包含解压的 rawHtml）
 */
export async function loadDocument(id: string): Promise<CapturedDocument | undefined> {
  const doc = await getDocument(id);
  if (!doc) return undefined;
  // 解压 rawHtml
  const compressed = (doc as CapturedDocument & { _compressedHtml?: string })._compressedHtml;
  if (compressed) {
    const decompressed = LZString.decompressFromUTF16(compressed);
    doc.rawHtml = decompressed ?? undefined;
  }
  return doc;
}

/**
 * 列出文档
 */
export async function getDocumentList(
  limit?: number,
  offset?: number
): ReturnType<typeof listDocuments> {
  return listDocuments(limit, offset);
}

/**
 * 删除文档
 */
export async function removeDocument(id: string): Promise<void> {
  await deleteDocument(id);
  await notifyIndexRemove(id);
}
