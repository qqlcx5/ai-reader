import { describe, it, expect, vi } from 'vitest';
import { runRoundtable } from '../roundtable';
import { ABORTED, type ProviderConfig, type StreamEvent } from '@/modules/provider';
import type { WorkflowCallbacks, WorkflowNodeSpec } from '../types';

vi.mock('@/modules/provider', async () => {
  class MockProvider {
    chatStream: (
      req: unknown,
      cb: (e: StreamEvent) => void,
    ) => Promise<{ providerId: string; model: string; startTime: number; firstTokenTime: number | null; endTime: number | null; totalLatency: number | null; tokensPerSecond: number | null; estimatedCost: number | null }>;
    config: ProviderConfig;
    constructor(config: ProviderConfig) {
      this.config = config;
      this.chatStream = vi.fn(async (req: unknown, cb: (e: StreamEvent) => void) => {
        const signal = (req as { signal?: AbortSignal }).signal;
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
          const role = this.config.id;
          setTimeout(() => {
            cb({ type: 'delta', content: `[${role}] ` });
            cb({ type: 'delta', content: 'hello' });
            resolve({
              providerId: this.config.id,
              model: this.config.model,
              startTime: start,
              firstTokenTime: start + 1,
              endTime: Date.now(),
              totalLatency: Date.now() - start,
              tokensPerSecond: 10,
              estimatedCost: 0.0001,
            });
          }, 5);
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

const cfg = (id: string): ProviderConfig => ({
  id,
  name: id,
  type: 'openai',
  model: 'gpt-4o',
  enabled: true,
  apiKey: 'sk-test',
});

const node = (id: string, name: string, prompt: string): WorkflowNodeSpec => ({
  id,
  order: parseInt(id, 10) || 0,
  name,
  providerId: id,
  systemPrompt: prompt,
  upstreamNodeIds: [],
});

describe('runRoundtable', () => {
  it('runs all 3 roles concurrently and gathers outputs', async () => {
    const deltas: string[] = [];
    const statuses: string[] = [];
    const cb: WorkflowCallbacks = {
      onNodeDelta: (id, d) => deltas.push(`${id}:${d}`),
      onNodeStatus: (id, s) => statuses.push(`${id}:${s}`),
    };
    const result = await runRoundtable({
      templateName: 'test',
      spec: [node('0', 'Red', 'critic'), node('1', 'Blue', 'defender'), node('2', 'Gray', 'referee')],
      userQuestion: 'Is X good?',
      contextContent: null,
      resolveProvider: (id) => cfg(id),
      callbacks: cb,
    });
    expect(result.session.nodes).toHaveLength(3);
    expect(result.session.status).toBe('done');
    expect(result.aborted).toBe(false);
    expect(Object.values(result.outputs).every((s) => s.startsWith('['))).toBe(true);
    expect(deltas.length).toBeGreaterThanOrEqual(6);
    expect(statuses.filter((s) => s.endsWith(':running'))).toHaveLength(3);
    expect(statuses.filter((s) => s.endsWith(':done'))).toHaveLength(3);
  });

  it('injects context into the system prompt', async () => {
    const seenPrompts: string[] = [];
    // Spy on chatStream by replacing the module
    const provMod = await import('@/modules/provider');
    const originalCreate = provMod.createProvider;
    (provMod as Record<string, unknown>).createProvider = (c: ProviderConfig) => {
      const p = originalCreate(c);
      const orig = p.chatStream.bind(p);
      p.chatStream = (req, cb) => {
        seenPrompts.push(req.systemPrompt ?? '');
        return orig(req, cb);
      };
      return p;
    };
    try {
      await runRoundtable({
        templateName: 't',
        spec: [node('0', 'A', 'sys')],
        userQuestion: 'q',
        contextContent: 'PAGE_CONTENT_HERE',
        resolveProvider: (id) => cfg(id),
      });
      expect(seenPrompts[0]).toContain('PAGE_CONTENT_HERE');
      expect(seenPrompts[0]).toContain('sys');
    } finally {
      (provMod as Record<string, unknown>).createProvider = originalCreate;
    }
  });

  it('one failing node does not stop the others', async () => {
    const result = await runRoundtable({
      templateName: 't',
      spec: [node('0', 'A', 'sys'), node('1', 'B', 'sys')],
      userQuestion: 'q',
      contextContent: null,
      resolveProvider: (id) => (id === '1' ? { ...cfg(id), enabled: false } : cfg(id)),
    });
    const a = result.session.nodes.find((n) => n.id === '0')!;
    const b = result.session.nodes.find((n) => n.id === '1')!;
    expect(a.status).toBe('done');
    expect(b.status).toBe('error');
    expect(result.session.status).toBe('error');
  });

  it('marks nodes as aborted when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runRoundtable({
      templateName: 't',
      spec: [node('0', 'A', 'sys'), node('1', 'B', 'sys')],
      userQuestion: 'q',
      contextContent: null,
      resolveProvider: (id) => cfg(id),
      signal: controller.signal,
    });
    expect(result.session.nodes.every((n) => n.status === 'aborted')).toBe(true);
    expect(result.aborted).toBe(true);
  });

  it('returns empty outputs when spec is empty', async () => {
    const result = await runRoundtable({
      templateName: 't',
      spec: [],
      userQuestion: 'q',
      contextContent: null,
      resolveProvider: (id) => cfg(id),
    });
    expect(result.outputs).toEqual({});
  });
});
