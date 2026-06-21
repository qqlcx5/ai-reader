import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runRelayChain } from '../relay';
import { ABORTED, type ProviderConfig, type StreamEvent } from '@/modules/provider';
import type { WorkflowNodeSpec } from '../types';

vi.mock('@/modules/provider', async () => {
  class MockProvider {
    chatStream: (
      req: unknown,
      cb: (e: StreamEvent) => void,
    ) => Promise<{ providerId: string; model: string; startTime: number; firstTokenTime: number | null; endTime: number | null; totalLatency: number | null; tokensPerSecond: number | null; estimatedCost: number | null }>;
    config: ProviderConfig;
    capturedInputs: string[];
    constructor(config: ProviderConfig) {
      this.config = config;
      this.capturedInputs = [];
      this.chatStream = vi.fn(async (req: unknown, cb: (e: StreamEvent) => void) => {
        const signal = (req as { signal?: AbortSignal }).signal;
        const userMsg = (req as { messages: Array<{ role: string; content: string }> }).messages[0]?.content ?? '';
        this.capturedInputs.push(userMsg);
        return new Promise<{
          providerId: string; model: string; startTime: number;
          firstTokenTime: number | null; endTime: number | null;
          totalLatency: number | null; tokensPerSecond: number | null;
          estimatedCost: number | null;
        }>((resolve, reject) => {
          if (signal?.aborted) {
            const err = new Error('aborted');
            (err as Error & { code: string }).code = ABORTED;
            reject(err);
            return;
          }
          const start = Date.now();
          signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            (err as Error & { code: string }).code = ABORTED;
            reject(err);
          });
          setTimeout(() => {
            const role = this.config.id;
            cb({ type: 'delta', content: `<${role}>` });
            cb({ type: 'delta', content: 'ok' });
            resolve({
              providerId: this.config.id,
              model: this.config.model,
              startTime: start,
              firstTokenTime: start + 1,
              endTime: Date.now(),
              totalLatency: Date.now() - start,
              tokensPerSecond: 10,
              estimatedCost: 0,
            });
          }, 5);
        });
      });
    }
  }
  const instances: MockProvider[] = [];
  return {
    createProvider: (cfg: ProviderConfig) => {
      const p = new MockProvider(cfg);
      instances.push(p);
      return p;
    },
    ProviderError: class extends Error {
      code: string;
      constructor(code: string, message: string) {
        super(message);
        this.code = code;
        this.name = 'ProviderError';
      }
    },
    ABORTED: 'ABORTED',
    __getInstances: () => instances,
    __resetInstances: () => {
      instances.length = 0;
    },
  };
});

const cfg = (id: string): ProviderConfig => ({
  id,
  name: id,
  type: 'openai',
  model: 'gpt-4o',
  enabled: true,
  apiKey: 'sk-test',
});

const node = (id: string, upstream: string[] = []): WorkflowNodeSpec => ({
  id,
  order: parseInt(id, 10) || 0,
  name: id,
  providerId: id,
  systemPrompt: `prompt-${id}`,
  upstreamNodeIds: upstream,
});

describe('runRelayChain', () => {
  it('runs nodes in topological order', async () => {
    const result = await runRelayChain({
      templateName: 't',
      spec: [node('2', ['1']), node('0'), node('1', ['0'])],
      userQuestion: 'ORIGINAL',
      contextContent: null,
      resolveProvider: (id) => cfg(id),
    });
    const ids = result.session.nodes.map((n) => n.id);
    expect(ids).toEqual(['0', '1', '2']);
  });

  it('stitches upstream outputs into downstream user message', async () => {
    const provMod = (await import('@/modules/provider')) as unknown as {
      __resetInstances: () => void;
      __getInstances: () => Array<{ config: ProviderConfig; capturedInputs: string[] }>;
    };
    provMod.__resetInstances();
    await runRelayChain({
      templateName: 't',
      spec: [node('0'), node('1', ['0'])],
      userQuestion: 'INITIAL',
      contextContent: null,
      resolveProvider: (id) => cfg(id),
    });
    const insts = provMod.__getInstances();
    // node '0' is first
    const a = insts.find((i) => i.config.id === '0')!;
    const b = insts.find((i) => i.config.id === '1')!;
    expect(a.capturedInputs[0]).toContain('INITIAL');
    expect(b.capturedInputs[0]).toContain('INITIAL');
    expect(b.capturedInputs[0]).toContain('Output from 0');
    expect(b.capturedInputs[0]).toContain('<0>ok');
  });

  it('includes contextContent in the input', async () => {
    const provMod = (await import('@/modules/provider')) as unknown as {
      __resetInstances: () => void;
      __getInstances: () => Array<{ config: ProviderConfig; capturedInputs: string[] }>;
    };
    provMod.__resetInstances();
    await runRelayChain({
      templateName: 't',
      spec: [node('0')],
      userQuestion: 'Q',
      contextContent: 'CTX_HERE',
      resolveProvider: (id) => cfg(id),
    });
    const a = provMod.__getInstances().find((i) => i.config.id === '0')!;
    expect(a.capturedInputs[0]).toContain('CTX_HERE');
  });

  it('aborts the pipeline when a node fails', async () => {
    const result = await runRelayChain({
      templateName: 't',
      spec: [node('0'), node('1', ['0']), node('2', ['1'])],
      userQuestion: 'Q',
      contextContent: null,
      resolveProvider: (id) => (id === '1' ? { ...cfg(id), enabled: false } : cfg(id)),
    });
    expect(result.session.nodes[0].status).toBe('done');
    expect(result.session.nodes[1].status).toBe('error');
    expect(['pending', 'aborted']).toContain(result.session.nodes[2].status);
    expect(result.session.status).toBe('error');
  });

  it('throws CycleDetectedError before running', async () => {
    await expect(
      runRelayChain({
        templateName: 't',
        spec: [node('a', ['b']), node('b', ['a'])],
        userQuestion: 'Q',
        contextContent: null,
        resolveProvider: (id) => cfg(id),
      }),
    ).rejects.toThrow();
  });

  it('handles already-aborted signal as pipeline pause', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runRelayChain({
      templateName: 't',
      spec: [node('0'), node('1', ['0'])],
      userQuestion: 'Q',
      contextContent: null,
      resolveProvider: (id) => cfg(id),
      signal: controller.signal,
    });
    expect(result.session.nodes.every((n) => n.status === 'aborted')).toBe(true);
    expect(result.aborted).toBe(true);
  });
});
