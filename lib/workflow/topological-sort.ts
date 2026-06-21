/**
 * M5 — Topological sort for Relay Chain node graphs.
 *
 * Detects cycles and returns a stable execution order that respects
 * every node's `upstreamNodeIds`. The algorithm is Kahn's algorithm
 * with a stable insertion order to keep the output deterministic.
 */
import type { WorkflowNodeSpec } from './types';

export class CycleDetectedError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Cycle detected in workflow graph: ${cycle.join(' -> ')}`);
    this.name = 'CycleDetectedError';
  }
}

/**
 * Returns a copy of `nodes` ordered so that every node appears after all
 * of its `upstreamNodeIds`. Throws `CycleDetectedError` if a cycle is
 * found.
 */
export function topologicalSort<T extends WorkflowNodeSpec>(nodes: T[]): T[] {
  if (nodes.length === 0) return [];

  const byId = new Map<string, T>();
  for (const n of nodes) byId.set(n.id, n);

  // Validate references
  for (const n of nodes) {
    for (const upId of n.upstreamNodeIds) {
      if (!byId.has(upId)) {
        throw new Error(`Node "${n.id}" references unknown upstream "${upId}"`);
      }
    }
  }

  // in-degree: count of upstreams that appear in `nodes`
  const inDegree = new Map<string, number>();
  const downstream = new Map<string, string[]>();
  for (const n of nodes) {
    inDegree.set(n.id, 0);
    downstream.set(n.id, []);
  }
  for (const n of nodes) {
    for (const upId of n.upstreamNodeIds) {
      if (!byId.has(upId)) continue;
      inDegree.set(n.id, (inDegree.get(n.id) ?? 0) + 1);
      downstream.get(upId)!.push(n.id);
    }
  }

  // Seed queue with all in-degree-0 nodes in their original `order`.
  const ready: T[] = nodes
    .filter((n) => (inDegree.get(n.id) ?? 0) === 0)
    .sort((a, b) => a.order - b.order);

  const result: T[] = [];
  while (ready.length > 0) {
    const node = ready.shift()!;
    result.push(node);

    for (const nextId of downstream.get(node.id) ?? []) {
      const d = (inDegree.get(nextId) ?? 0) - 1;
      inDegree.set(nextId, d);
      if (d === 0) {
        const next = byId.get(nextId);
        if (next) {
          // Keep stable order: insert by `order` so the resulting
          // schedule is deterministic across runs.
          const insertAt = ready.findIndex((n) => n.order > next.order);
          if (insertAt === -1) ready.push(next);
          else ready.splice(insertAt, 0, next);
        }
      }
    }
  }

  if (result.length !== nodes.length) {
    // Find a participating node for a useful error message.
    const stuck = nodes.find((n) => !result.includes(n));
    const cycle = stuck ? collectCycle(stuck.id, byId, downstream) : [];
    throw new CycleDetectedError(cycle);
  }

  return result;
}

function collectCycle(
  startId: string,
  byId: Map<string, WorkflowNodeSpec>,
  downstream: Map<string, string[]>,
): string[] {
  const seen = new Set<string>();
  const path: string[] = [];
  let cur: string | undefined = startId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    path.push(cur);
    const children: string[] = downstream.get(cur) ?? [];
    cur = children[0];
  }
  if (cur) path.push(cur); // close the loop
  return path;
}

/** True iff the given graph has a cycle. Useful for save-time validation. */
export function hasCycle(nodes: WorkflowNodeSpec[]): boolean {
  try {
    topologicalSort(nodes);
    return false;
  } catch (err) {
    return err instanceof CycleDetectedError;
  }
}
