/**
 * Multi-Model Scheduler
 *
 * Orchestrates 1-4 concurrent LLM requests. Each model runs independently
 * with its own SSE connection, retry, and abort capability.
 *
 * Uses M3 Provider Client (chatStream) for each model.
 *
 * Based on design-04-workspace.md §4.
 */

import type { ProviderConfig } from '../providers/types';
import type { ChatMessage } from '../providers/types';
import type { Conversation, Message, SchedulerCallbacks } from './types';
import {
  generateId,
  createModelResponse,
} from './types';
import type { ResponseStatus, ResponseMetrics, ResponseError } from './types';
import { createProvider } from '../providers/factory';

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Run a multi-model chat session.
 *
 * Launches all providers concurrently via Promise.all, each with
 * independent streaming, error handling, and abort capability.
 *
 * @param conversation - Current conversation
 * @param userContent - User's question text
 * @param providers - Active provider configurations (1-4)
 * @param contextText - Extracted page context for system prompt
 * @param callbacks - Delta / status / metrics / error callbacks
 * @param signal - Global abort signal
 */
export async function runMultiModelChat(
  conversation: Conversation,
  userContent: string,
  providers: ProviderConfig[],
  contextText: string | null,
  callbacks: SchedulerCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const systemPrompt = buildSystemPrompt(contextText);

  const messages: ChatMessage[] = [
    { role: 'user', content: userContent },
  ];

  // Launch all providers in parallel
  const tasks = providers.map((providerConfig) =>
    runSingleModel(providerConfig, systemPrompt, messages, callbacks, signal),
  );

  await Promise.allSettled(tasks);
}

/**
 * Run a single model within the multi-model session.
 * Exported for use in "Continue with this" branching.
 */
export async function runSingleModelChat(
  providerConfig: ProviderConfig,
  systemPrompt: string,
  messages: ChatMessage[],
  callbacks: SchedulerCallbacks,
  signal?: AbortSignal,
): Promise<ResponseMetrics> {
  return runSingleModel(providerConfig, systemPrompt, messages, callbacks, signal);
}

// ─── Internal ────────────────────────────────────────────────────────

async function runSingleModel(
  providerConfig: ProviderConfig,
  systemPrompt: string,
  messages: ChatMessage[],
  callbacks: SchedulerCallbacks,
  signal?: AbortSignal,
): Promise<ResponseMetrics> {
  const pid = providerConfig.id;
  const metrics: ResponseMetrics = {
    startTime: Date.now(),
    firstTokenTime: null,
    endTime: null,
    totalLatency: null,
    tokensPerSecond: null,
    estimatedCost: null,
  };

  // Notify UI of pending → streaming transition
  callbacks.onStatus(pid, 'pending');

  try {
    // Abort before starting?
    if (signal?.aborted) {
      callbacks.onStatus(pid, 'aborted');
      return metrics;
    }

    const provider = createProvider(providerConfig);

    callbacks.onStatus(pid, 'streaming');

    const requestMetrics = await provider.chatStream(
      {
        providerId: pid,
        systemPrompt,
        messages,
        signal,
      },
      (event) => {
        if (signal?.aborted) {
          callbacks.onStatus(pid, 'aborted');
          return;
        }

        switch (event.type) {
          case 'start':
            metrics.startTime = event.timestamp;
            break;

          case 'delta':
            if (metrics.firstTokenTime === null) {
              metrics.firstTokenTime = Date.now();
            }
            callbacks.onDelta(pid, event.content);
            break;

          case 'usage':
            metrics.estimatedCost = requestMetrics.estimatedCost;
            callbacks.onMetrics(pid, {
              ...metrics,
              estimatedCost: requestMetrics.estimatedCost,
            });
            break;

          case 'done':
            metrics.endTime = Date.now();
            metrics.totalLatency = metrics.endTime - metrics.startTime;
            callbacks.onStatus(pid, 'done');
            callbacks.onMetrics(pid, metrics);
            break;

          case 'error':
            callbacks.onStatus(pid, 'error');
            callbacks.onError(pid, {
              code: event.code,
              message: event.message,
              retryable: event.code === 'RATE_LIMIT' || event.code === 'SERVER_ERROR',
            });
            break;
        }
      },
    );

    // Final metrics from chatStream return
    if (requestMetrics.firstTokenTime && !metrics.firstTokenTime) {
      metrics.firstTokenTime = requestMetrics.firstTokenTime;
    }
    if (requestMetrics.endTime && !metrics.endTime) {
      metrics.endTime = requestMetrics.endTime;
      metrics.totalLatency = requestMetrics.totalLatency;
    }

    callbacks.onStatus(pid, 'done');
    return metrics;
  } catch (err) {
    metrics.endTime = Date.now();
    metrics.totalLatency = metrics.endTime - metrics.startTime;

    const message = err instanceof Error ? err.message : String(err);
    callbacks.onStatus(pid, 'error');
    callbacks.onError(pid, {
      code: 'RUNTIME_ERROR',
      message,
      retryable: false,
    });

    return metrics;
  }
}

// ─── System Prompt Builder ───────────────────────────────────────────

/**
 * Build a system prompt from extracted context.
 * Follows the pattern from nextai-translator's mode-specific prompts.
 */
function buildSystemPrompt(contextText: string | null): string {
  if (!contextText) {
    return 'You are a helpful AI assistant. Answer the user\'s questions concisely and accurately.';
  }

  // Truncate context to ~8K chars to avoid overwhelming the system prompt
  const maxContext = 8000;
  const truncated = contextText.length > maxContext
    ? contextText.slice(0, maxContext) + '\n\n[Content truncated...]'
    : contextText;

  return `You are an AI reader assistant. Below is the content of the article/webpage the user is reading.

=== ARTICLE CONTENT ===
${truncated}
=== END ARTICLE CONTENT ===

Use the article content above as context to answer the user's questions. When referencing specific parts, quote or cite them. If the question is not related to the article, answer based on your general knowledge.

Guidelines:
- Be accurate and concise
- Cite specific passages when relevant
- If information is not in the article, say so clearly
- Format answers in Markdown for readability`;
}
