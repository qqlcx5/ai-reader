/**
 * M4 — Multi-Model Concurrent Scheduler
 *
 * 负责：
 *   - 1~4 Provider 并发执行 chatStream
 *   - 每个 Provider 独立的 AbortController
 *   - 分发 onDelta / onStatus / onMetrics 回调
 *   - 用户 Abort 时将对应 ModelResponse 标记为 'aborted'
 *
 * 不负责：
 *   - UI 渲染（交给 components/workspace/*）
 *   - 数据持久化（调用方把 update 通过 callback 写入 conversation.store）
 */

import { createProvider, ProviderError, ABORTED, type ChatRequest, type RequestMetrics, type StreamEvent } from '@/modules/provider';
import { buildHistoryMessages } from './buildSystemPrompt';
import type {
  RunRequest,
  RunResult,
  SchedulerCallbacks,
  ModelResponseStatus,
} from './types';

/** 把单模型结果归一为 RunResult */
function buildResult(
  providerId: string,
  status: RunResult['status'],
  metrics: RequestMetrics | null,
  error?: { code: string; message: string },
): RunResult {
  return { providerId, status, metrics, error };
}

/** 单模型执行体：构造请求 → chatStream → 派发回调 */
export async function runSingleModel(
  providerConfig: import('@/modules/provider').ProviderConfig,
  systemPrompt: string | undefined,
  messages: import('@/modules/provider').ChatMessage[],
  callbacks: SchedulerCallbacks,
  parentSignal?: AbortSignal,
): Promise<RunResult> {
  const providerId = providerConfig.id;
  const controller = new AbortController();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort(parentSignal.reason);
    else parentSignal.addEventListener('abort', () => controller.abort(parentSignal.reason), { once: true });
  }

  callbacks.onStatus(providerId, 'streaming');

  let provider;
  try {
    provider = createProvider(providerConfig);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error = { code: 'INIT_FAILED', message };
    callbacks.onError(providerId, error);
    callbacks.onStatus(providerId, 'error');
    return buildResult(providerId, 'error', null, error);
  }

  const request: ChatRequest = {
    providerId,
    systemPrompt,
    messages,
    signal: controller.signal,
  };

  let lastMetrics: RequestMetrics | null = null;
  let aborted = false;
  let error: { code: string; message: string } | undefined;

  try {
    lastMetrics = await provider.chatStream(request, (event: StreamEvent) => {
      if (controller.signal.aborted) return;
      switch (event.type) {
        case 'delta':
          callbacks.onDelta(providerId, event.content);
          break;
        case 'error':
          error = { code: event.code, message: event.message };
          callbacks.onError(providerId, error);
          break;
        case 'done':
        case 'usage':
        case 'start':
          // 由 chatStream 内部指标模块处理；这里无需分发
          break;
      }
    });

    if (controller.signal.aborted) {
      aborted = true;
      callbacks.onStatus(providerId, 'aborted');
      return buildResult(providerId, 'aborted', lastMetrics);
    }

    callbacks.onStatus(providerId, 'done');
    if (lastMetrics) callbacks.onMetrics(providerId, lastMetrics);
    return buildResult(providerId, 'done', lastMetrics);
  } catch (err) {
    if (err instanceof ProviderError && err.code === ABORTED) {
      aborted = true;
      callbacks.onStatus(providerId, 'aborted');
      return buildResult(providerId, 'aborted', lastMetrics);
    }
    if (controller.signal.aborted) {
      callbacks.onStatus(providerId, 'aborted');
      return buildResult(providerId, 'aborted', lastMetrics);
    }
    const message = err instanceof Error ? err.message : String(err);
    error = { code: 'STREAM_FAILED', message };
    callbacks.onError(providerId, error);
    callbacks.onStatus(providerId, 'error');
    return buildResult(providerId, 'error', lastMetrics, error);
  }
}

/**
 * 多模型并发执行入口。所有 provider 并行运行；任一 provider 异常不会影响其他。
 */
export async function runMultiModelChat(req: RunRequest): Promise<RunResult[]> {
  const { conversation, userMessage, providers, context, callbacks, signal } = req;
  if (providers.length === 0) return [];
  if (providers.length > 4) {
    // 设计上限：1~4 模型
    return [];
  }

  const messages = buildHistoryMessages(
    conversation,
    { role: userMessage.role === 'system' ? 'user' : userMessage.role, content: userMessage.content },
    [],
    context,
  );

  const tasks = providers.map((cfg) =>
    runSingleModel(cfg, messages[0]?.role === 'system' ? messages[0].content : undefined, messages, callbacks, signal),
  );

  // Promise.allSettled：任意 provider 抛错也不影响其他
  const settled = await Promise.allSettled(tasks);
  return settled.map((s) => (s.status === 'fulfilled' ? s.value : buildResult('unknown', 'error', null, { code: 'UNKNOWN', message: String(s.reason) })));
}

/** 工具函数：把 ModelResponse 状态集合转为存储层可用的 patch 列表 */
export function diffModelResponses(prev: ModelResponseStatus[], next: ModelResponseStatus[]): ModelResponseStatus[] {
  // 简化：直接返回 next；调用方在 store 中按 providerId 合并
  return next;
}
