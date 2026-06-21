/**
 * M5 Workflows — Relay Chain Orchestrator
 *
 * Executes a relay chain workflow: nodes run sequentially in topological
 * order. Each downstream node receives the output of its upstream nodes
 * concatenated as part of its input.
 *
 * Based on design-05-workflows.md §5.
 */

import type {
  WorkflowSession,
  WorkflowNode,
  WorkflowNodeStatus,
  WorkflowContext,
  WorkflowCallbacks,
} from './types';
import { createProvider } from '../providers';

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Execute a relay chain workflow.
 *
 * Nodes are topologically sorted, then executed one by one.
 * The initial input is the user's question; each downstream node
 * receives upstream outputs concatenated into its user message.
 */
export async function runRelayChain(
  session: WorkflowSession,
  initialInput: string,
  context: WorkflowContext | null,
  callbacks: WorkflowCallbacks,
): Promise<void> {
  const sortedNodes = topologicalSort(session.nodes);
  const outputs = new Map<string, string>();
  const contextText = buildContextText(context);

  for (const node of sortedNodes) {
    const input = buildNodeInput(node, initialInput, outputs, contextText);
    await executeRelayNode(node, input, callbacks);

    if (node.status === 'error') {
      callbacks.onWorkflowDone('error', node.error?.message ?? 'Unknown error');
      return;
    }

    if (node.output) {
      outputs.set(node.id, node.output);
    }
  }

  callbacks.onWorkflowDone('done');
}

// ─── Graph Utilities ─────────────────────────────────────────────────

/**
 * Topological sort of workflow nodes based on upstreamNodeIds.
 * Throws if a cycle is detected.
 */
function topologicalSort(nodes: WorkflowNode[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map(nodes.map((n) => [n.id, n.upstreamNodeIds.length]));
  const adjList = new Map<string, string[]>();

  for (const node of nodes) {
    adjList.set(node.id, []);
    for (const upstreamId of node.upstreamNodeIds) {
      if (!adjList.has(upstreamId)) {
        adjList.set(upstreamId, []);
      }
      adjList.get(upstreamId)!.push(node.id);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: WorkflowNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(nodeMap.get(id)!);

    for (const neighbor of adjList.get(id) || []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error('Cycle detected in workflow graph');
  }

  return sorted;
}

// ─── Node Execution ──────────────────────────────────────────────────

async function executeRelayNode(
  node: WorkflowNode,
  input: string,
  callbacks: WorkflowCallbacks,
): Promise<void> {
  node.status = 'running';
  callbacks.onNodeStatus(node.id, 'running');

  try {
    const provider = createProvider(getProviderConfigStub(node.providerId));

    let output = '';
    await provider.chatStream(
      {
        providerId: node.providerId,
        systemPrompt: node.systemPrompt,
        messages: [{ role: 'user', content: input }],
      },
      (event) => {
        switch (event.type) {
          case 'delta':
            output += event.content;
            callbacks.onNodeDelta(node.id, event.content);
            break;
          case 'error':
            node.error = { code: event.code, message: event.message, at: Date.now() };
            node.status = 'error';
            callbacks.onNodeStatus(node.id, 'error');
            break;
        }
      },
    );

    if ((node.status as WorkflowNodeStatus) !== 'error') {
      node.output = output;
      node.status = 'done';
      callbacks.onNodeStatus(node.id, 'done');
    }
  } catch (err) {
    node.status = 'error';
    node.error = {
      code: 'NODE_ERROR',
      message: err instanceof Error ? err.message : String(err),
      at: Date.now(),
    };
    callbacks.onNodeStatus(node.id, 'error');
  }
}

// ─── Input Building ──────────────────────────────────────────────────

function buildNodeInput(
  node: WorkflowNode,
  initialInput: string,
  outputs: Map<string, string>,
  contextText: string,
): string {
  const parts: string[] = [];

  // Context first
  if (contextText) {
    parts.push(contextText);
  }

  // Upstream outputs
  for (const upstreamId of node.upstreamNodeIds) {
    const upstreamOutput = outputs.get(upstreamId);
    if (upstreamOutput) {
      parts.push(`[Output from "${upstreamId}"]\n${upstreamOutput}`);
    }
  }

  // Initial input
  if (node.upstreamNodeIds.length === 0) {
    parts.push(initialInput);
  }

  return parts.join('\n\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────

function buildContextText(context: WorkflowContext | null): string {
  if (!context?.pageText) return '';
  return [
    `[Context: Page "${context.pageTitle}" (${context.pageUrl})]`,
    context.pageText.slice(0, 12000),
  ].join('\n\n');
}

function getProviderConfigStub(providerId: string) {
  return {
    id: providerId,
    name: providerId,
    type: 'openai' as const,
    model: 'gpt-4o-mini',
    enabled: true,
  };
}
