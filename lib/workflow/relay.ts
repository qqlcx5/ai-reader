/**
 * M5 — Relay Chain (模型接力链).
 *
 * Serial execution of nodes, where each node's user message is stitched
 * with all upstream outputs (and the original input + context). A single
 * node failure aborts the remaining pipeline.
 */
import { createProvider, type ProviderConfig, ABORTED, ProviderError } from '@/modules/provider';
import {
  buildRelayInput,
  initRuntimeNodes,
  markAborted,
  markDone,
  markError,
  markRunning,
  resolveProviderOrThrow,
} from './runner';
import { topologicalSort } from './topological-sort';
import type { RunWorkflowOptions, RunWorkflowResult, WorkflowNodeSpec } from './types';

export interface RunRelayChainOptions extends Omit<RunWorkflowOptions, 'session'> {
  templateName: string;
  spec: WorkflowNodeSpec[];
}

/**
 * Execute nodes in topological order. Stops as soon as a node fails or
 * the abort signal fires.
 */
export async function runRelayChain(options: RunRelayChainOptions): Promise<RunWorkflowResult> {
  const { spec, userQuestion, contextContent, resolveProvider, callbacks, signal } = options;

  // Detect cycles up-front; throws CycleDetectedError.
  const sorted = topologicalSort(spec);
  const nameById = new Map(sorted.map((n) => [n.id, n.name]));

  const now = Date.now();
  const session: import('./types').WorkflowSession = {
    id: crypto.randomUUID(),
    type: 'relay',
    title: options.templateName,
    createdAt: now,
    updatedAt: now,
    contextId: null,
    nodes: initRuntimeNodes(sorted),
    status: 'running',
  };
  callbacks?.onSessionStatus?.('running');

  const outputs = new Map<string, string>();
  let aborted = false;
  let pipelineError: { code: string; message: string } | null = null;

  for (const node of session.nodes) {
    if (signal?.aborted || aborted) {
      aborted = true;
      markAborted(node, callbacks);
      continue;
    }

    let providerCfg: ProviderConfig;
    try {
      providerCfg = resolveProviderOrThrow(node.providerId, resolveProvider);
    } catch (err) {
      const e = err as Error & { code?: string };
      markError(node, { code: e.code ?? 'UNKNOWN_PROVIDER', message: e.message }, callbacks);
      pipelineError = { code: e.code ?? 'UNKNOWN_PROVIDER', message: e.message };
      break;
    }

    markRunning(node, callbacks);
    const input = buildRelayInput({
      initialInput: userQuestion,
      upstreamOutputs: outputs,
      upstreamNodeIds: node.upstreamNodeIds,
      upstreamNames: nameById,
      contextContent,
    });

    let output = '';
    let nodeAborted = false;
    try {
      const provider = createProvider(providerCfg);
      await provider.chatStream(
        {
          providerId: providerCfg.id,
          systemPrompt: node.systemPrompt,
          messages: [{ role: 'user', content: input }],
          signal,
        },
        (event) => {
          if (event.type === 'delta') {
            output += event.content;
            callbacks?.onNodeDelta?.(node.id, event.content);
          }
        },
      );
      if (signal?.aborted) nodeAborted = true;
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === ABORTED) {
        nodeAborted = true;
      } else {
        markError(node, { code: e.code ?? 'PROVIDER_ERROR', message: e.message }, callbacks);
        pipelineError = { code: e.code ?? 'PROVIDER_ERROR', message: e.message };
        break;
      }
    }

    if (nodeAborted) {
      aborted = true;
      markAborted(node, callbacks);
      continue;
    }

    outputs.set(node.id, output);
    markDone(node, output, callbacks);
  }

  const allDone = session.nodes.every((n) => n.status === 'done');
  const finalStatus: import('./types').WorkflowSession['status'] = pipelineError
    ? 'error'
    : aborted
    ? 'paused'
    : allDone
    ? 'done'
    : 'paused';
  session.status = finalStatus;
  session.updatedAt = Date.now();
  callbacks?.onSessionStatus?.(finalStatus);

  const out: Record<string, string> = {};
  for (const n of session.nodes) out[n.id] = n.output;
  return { session, outputs: out, aborted };
}

export { ABORTED, ProviderError, topologicalSort };
