import { describe, it, expect } from 'vitest';
import { topologicalSort, hasCycle, CycleDetectedError } from '../topological-sort';
import type { WorkflowNodeSpec } from '../types';

const node = (id: string, upstream: string[] = [], order = 0): WorkflowNodeSpec => ({
  id,
  order,
  name: id,
  providerId: 'p',
  systemPrompt: 'x',
  upstreamNodeIds: upstream,
});

describe('topologicalSort', () => {
  it('returns [] for empty graph', () => {
    expect(topologicalSort([])).toEqual([]);
  });

  it('keeps standalone nodes in declared order', () => {
    const result = topologicalSort([node('a', [], 2), node('b', [], 0), node('c', [], 1)]);
    expect(result.map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('orders nodes after their upstreams', () => {
    const result = topologicalSort([
      node('c', ['b'], 2),
      node('a', [], 0),
      node('b', ['a'], 1),
    ]);
    expect(result.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('handles diamond dependencies', () => {
    const result = topologicalSort([
      node('d', ['b', 'c'], 3),
      node('b', ['a'], 1),
      node('c', ['a'], 2),
      node('a', [], 0),
    ]);
    expect(result.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('throws CycleDetectedError on a self-loop', () => {
    expect(() => topologicalSort([node('a', ['a'])])).toThrow(CycleDetectedError);
  });

  it('throws CycleDetectedError on a 2-node cycle', () => {
    expect(() => topologicalSort([node('a', ['b']), node('b', ['a'])])).toThrow(CycleDetectedError);
  });

  it('throws on unknown upstream reference', () => {
    expect(() => topologicalSort([node('a', ['missing'])])).toThrow(/unknown upstream/);
  });
});

describe('hasCycle', () => {
  it('returns true on cycles', () => {
    expect(hasCycle([node('a', ['b']), node('b', ['a'])])).toBe(true);
  });

  it('returns false on DAG', () => {
    expect(hasCycle([node('a'), node('b', ['a']), node('c', ['b'])])).toBe(false);
  });
});
