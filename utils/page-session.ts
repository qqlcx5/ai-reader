/**
 * Page-Isolated Session Manager
 * URL → PageRecord → Conversation binding core logic.
 */
import { pageRepo, hashUrl, normalizeUrl } from '@/modules/storage/repositories/page.repo';
import { conversationRepo } from '@/modules/storage/repositories/conversation.repo';
import type { PageRecord } from '@/modules/storage/types';

export interface SessionResult {
  pageId: string;
  conversationId: string;
  isNew: boolean;
  existingContent?: PageRecord['content'];
}

/**
 * Find or create a Page Session for the given URL.
 * - If PageRecord exists: return existing conversationId and content
 * - If not: create a new Conversation, create an empty PageRecord
 */
export async function getOrCreateSession(
  url: string,
  title: string,
  favicon = '',
): Promise<SessionResult> {
  const pageId = await hashUrl(url);
  const existing = await pageRepo.findById(pageId);

  if (existing) {
    return {
      pageId,
      conversationId: existing.conversationId,
      isNew: false,
      existingContent: existing.content,
    };
  }

  const conversation = await conversationRepo.create({
    title: title || normalizeUrl(url),
    mode: 'chat',
    activeProviderIds: [],
  });

  const record: PageRecord = {
    id: pageId,
    url: normalizeUrl(url),
    title: title || '',
    favicon,
    timestamp: Date.now(),
    content: { rawText: '', wordCount: 0 },
    conversationId: conversation.id,
  };
  await pageRepo.upsert(record);

  return {
    pageId,
    conversationId: conversation.id,
    isNew: true,
  };
}

/**
 * After extraction, update the PageRecord content field.
 */
export async function updatePageContent(pageId: string, rawText: string): Promise<void> {
  const existing = await pageRepo.findById(pageId);
  if (!existing) return;
  const wordCount = countWords(rawText);
  await pageRepo.upsert({
    ...existing,
    content: { rawText, wordCount },
    timestamp: Date.now(),
  });
}

function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const words = (text.match(/[a-zA-Z]+/g) || []).length;
  return cjk + words;
}
