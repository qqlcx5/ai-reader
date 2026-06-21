import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMultiModelChat, runSingleModel } from '../scheduler';
import type { ProviderConfig, StreamEvent, RequestMetrics } from '@/modules/provider';
import type { Conversation, Message, SchedulerCallbacks } from '../types';

// Mock the provider module
vi.mock('@/modules/provider', async () => {
  class MockProvider {
    chatStream: (req: unknown, cb: (e: StreamEvent) => void) => Promise<RequestMetrics>;
    config: ProviderConfig;
    constructor(config: ProviderConfig) {
      this.config = config;
      const baseDelay = 5;
      this.chatStream = vi.fn(async (req: unknown, cb: (e: StreamEvent) => void) => {
        const signal = (req as { signal?: AbortSignal }).signal;
        return new Promise<RequestMetrics>((resolve, reject) => {
          const start = Date.now();
          if (signal?.aborted) {
            const err = new Error('aborted');
            (err as Error & { code: string }).code = 'ABORTED';
            reject(err);
            return;
          }
          signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            (err as Error & { code: string }).code = 'ABORTED';
            reject(err);
          });
          setTimeout(() => {
            cb({ type: 'delta', content: 'hello' });
            cb({ type: 'delta', content: ' world' });
            const end = Date.now();
            resolve({
              providerId: this.config.id,
              model: this.config.model,
              startTime: start,
              firstTokenTime: start + 1,
              endTime: end,
              totalLatency: end - start,
              tokensPerSecond: 10,
              estimatedCost: 0.001,
            });
          }, baseDelay);
        });
      });
    }
  }
  return {
    createProvider: (cfg: ProviderConfig) => new MockProvider(cfg),
    ProviderError: class extends Error {
      code: string;
      constructor(code: string, message: string) {
        super(message);
        this.code = code;
        this.name = 'ProviderError';
      }
    },
    ABORTED: 'ABORTED',
  };
});

function makeConfig(id: string): ProviderConfig {
  return {
    id,
    name: `P-${id}`,
    type: 'openai',
    model: 'gpt-4o',
    enabled: true,
    apiKey: 'sk-test',
  };
}

function makeConversation(): Conversation {
  return {
    id: 'conv-1',
    title: 'T',
    createdAt: 0,
    updatedAt: 0,
    activeProviderIds: ['p1', 'p2'],
    mode: 'chat',
  };
}

function makeUserMessage(): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    parentId: null,
    role: 'user',
    content: 'Hi',
    modelResponses: [],
    createdAt: 0,
  };
}

function makeCallbacks(): SchedulerCallbacks & { deltas: string[]; statuses: string[]; metricsCount: number } {
  const obj: SchedulerCallbacks & { deltas: string[]; statuses: string[]; metricsCount: number } = {
    deltas: [],
    statuses: [],
    metricsCount: 0,
    onDelta: (pid, d) => obj.deltas.push(`${pid}:${d}`),
    onStatus: (pid, s) => obj.statuses.push(`${pid}:${s}`),
    onMetrics: () => obj.metricsCount++,
    onError: () => {},
  };
  return obj;
}

describe('runMultiModelChat', () => {
  it('returns empty array when no providers', async () => {
    const results = await runMultiModelChat({
      conversation: makeConversation(),
      userMessage: makeUserMessage(),
      providers: [],
      context: null,
      callbacks: makeCallbacks(),
    });
    expect(results).toEqual([]);
  });

  it('rejects when more than 4 providers', async () => {
    const results = await runMultiModelChat({
      conversation: makeConversation(),
      userMessage: makeUserMessage(),
      providers: [makeConfig('p1'), makeConfig('p2'), makeConfig('p3'), makeConfig('p4'), makeConfig('p5')],
      context: null,
      callbacks: makeCallbacks(),
    });
    expect(results).toEqual([]);
  });

  it('runs all providers concurrently and collects done results', async () => {
    const cb = makeCallbacks();
    const results = await runMultiModelChat({
      conversation: makeConversation(),
      userMessage: makeUserMessage(),
      providers: [makeConfig('p1'), makeConfig('p2'), makeConfig('p3')],
      context: null,
      callbacks: cb,
    });
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'done')).toBe(true);
    expect(cb.deltas).toEqual(expect.arrayContaining(['p1:hello', 'p1: world', 'p2:hello', 'p3:hello']));
    expect(cb.statuses.filter((s) => s.endsWith(':streaming'))).toHaveLength(3);
    expect(cb.statuses.filter((s) => s.endsWith(':done'))).toHaveLength(3);
    expect(cb.metricsCount).toBe(3);
  });
});

describe('runSingleModel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns aborted result when parent signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const cb = makeCallbacks();
    const r = await runSingleModel(makeConfig('p1'), 'system', [{ role: 'user', content: 'q' }], cb, controller.signal);
    expect(r.status).toBe('aborted');
  });

  it('returns done with metrics on success', async () => {
    const cb = makeCallbacks();
    const r = await runSingleModel(makeConfig('p1'), 'system', [{ role: 'user', content: 'q' }], cb);
    expect(r.status).toBe('done');
    expect(r.metrics).not.toBeNull();
    expect(r.metrics?.providerId).toBe('p1');
  });
});
