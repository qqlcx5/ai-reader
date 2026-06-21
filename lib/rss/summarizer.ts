/**
 * M8 — AI summarizer.
 *
 * Generates a 3-sentence summary for each new RSS item using a
 * lightweight LLM provider (M3). Runs in a serial queue to avoid
 * concurrent API cost spikes. Summarization is opt-in (default off)
 * to prevent unexpected billing.
 */
import type { SummaryJob, SummarizerOptions } from './types';
import type { ProviderConfig as M3ProviderConfig } from '@/modules/provider/types';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_CONTENT_LENGTH = 8000;

const SUMMARY_PROMPT = '请用 3 句话总结这篇文章的核心观点。';

/**
 * Summarize a single RSS item using the configured provider.
 *
 * Returns the summary string, or null if summarization fails
 * (caller should mark the item as `isSummarized = false`).
 */
export async function summarizeItem(
  job: SummaryJob,
  options: SummarizerOptions,
): Promise<string | null> {
  if (!options.enabled) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const { createProvider } = await import('@/modules/provider/factory');
    const { useSettingsStore } = await import('@/stores/settings.store');
    const store = useSettingsStore();

    // Find the provider config by ID.
    const storeProvider = store.settings.providers.find(
      (p) => p.id === options.providerId,
    );
    if (!storeProvider) {
      // eslint-disable-next-line no-console
      console.warn(`[rss:summarizer] provider ${options.providerId} not found`);
      return null;
    }

    // The provider factory expects `model` (required). M7 stores
    // `defaultModel` — use that as the model name.
    const providerConfig: M3ProviderConfig = {
      ...storeProvider,
      model: storeProvider.defaultModel ?? 'gpt-4o-mini',
    } as M3ProviderConfig;
    const provider = createProvider(providerConfig);
    let summary = '';

    await provider.chatStream(
      {
        providerId: options.providerId,
        signal: controller.signal,
        messages: [
          {
            role: 'user',
            content: `${SUMMARY_PROMPT}\n\n标题：${job.title}\n\n正文：${truncate(job.content, MAX_CONTENT_LENGTH)}`,
          },
        ],
      },
      (event) => {
        if (event.type === 'delta') {
          summary += event.content;
        }
      },
    );

    return summary.trim() || null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[rss:summarizer] failed', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Process a batch of summary jobs serially.
 *
 * Returns a map of itemId → summary (or absent if summarization failed).
 */
export async function summarizeBatch(
  jobs: SummaryJob[],
  options: SummarizerOptions,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const job of jobs) {
    const summary = await summarizeItem(job, options);
    if (summary) {
      results.set(job.itemId, summary);
    }
  }

  return results;
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}
