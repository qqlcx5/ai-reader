/**
 * M8 RSS Pipeline — AI Summarizer
 *
 * Calls the configured LLM provider to generate 3-sentence summaries
 * for new RSS items. Runs in a serial queue to avoid overwhelming
 * the provider with concurrent requests.
 *
 * Based on design-08-rss-pipeline.md §6.
 */

import type { RssItem } from './types';
import { createProvider } from '../providers';
import { loadRssConfig } from './feed-store';

// ─── Constants ────────────────────────────────────────────────────────

const SUMMARY_PROMPT = '请用 3 句话总结以下文章的核心观点。回复应简洁、客观、仅包含摘要内容。';
const MAX_CONTENT_LENGTH = 8000;
const SUMMARY_TIMEOUT_MS = 30000;

// ─── Serial Queue ────────────────────────────────────────────────────

let pendingQueue: RssItem[] = [];
let isProcessing = false;

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Add items to the summarization queue.
 * Processing happens serially in the background.
 */
export async function summarizeNewItems(items: RssItem[]): Promise<void> {
  const config = await loadRssConfig();
  if (!config.autoSummarize || !config.summaryProviderId) return;

  const itemsToSummarize = items.filter(
    (item) => item.content && item.content.length > 0,
  );

  if (itemsToSummarize.length === 0) return;

  pendingQueue.push(...itemsToSummarize);

  if (!isProcessing) {
    processQueue(config.summaryProviderId);
  }
}

/**
 * Summarize a single item. Returns the generated summary string.
 */
export async function summarizeSingleItem(
  item: RssItem,
  providerId: string,
): Promise<string> {
  const provider = createProvider({
    id: providerId,
    name: providerId,
    type: 'openai',
    model: 'gpt-4o-mini',
    enabled: true,
  });

  let summary = '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);

    await provider.chatStream(
      {
        providerId,
        messages: [
          {
            role: 'user',
            content: `${SUMMARY_PROMPT}\n\n标题：${item.title}\n\n正文：${(item.content || '').slice(0, MAX_CONTENT_LENGTH)}`,
          },
        ],
        signal: controller.signal,
      },
      (event) => {
        if (event.type === 'delta') {
          summary += event.content;
        }
      },
    );

    clearTimeout(timeoutId);

    item.aiSummary = summary;
    item.isSummarized = true;
  } catch (err) {
    item.isSummarized = true; // Mark as processed even on error
    item.aiSummary = `[Summary unavailable: ${err instanceof Error ? err.message : String(err)}]`;
  }

  return summary;
}

// ─── Internal Queue Processing ───────────────────────────────────────

async function processQueue(providerId: string): Promise<void> {
  isProcessing = true;

  while (pendingQueue.length > 0) {
    const item = pendingQueue.shift();
    if (!item) break;

    try {
      await summarizeSingleItem(item, providerId);
    } catch {
      // Error already attached to item — continue with next
    }
  }

  isProcessing = false;
}
