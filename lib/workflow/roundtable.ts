/**
 * M5 — Roundtable (圆桌讨论).
 *
 * Concurrent fan-out: each node receives the same user question and its
 * own role system prompt. Failures of one node do not stop the others.
 */
import { createProvider, type ProviderConfig, ABORTED, ProviderError } from '@/modules/provider';
import {
  buildContextPrefix,
  initRuntimeNodes,
  markAborted,
  markDone,
  markError,
  markRunning,
  resolveProviderOrThrow,
} from './runner';
import type { RunWorkflowOptions, RunWorkflowResult, WorkflowNodeSpec } from './types';

export interface RunRoundtableOptions
  extends Omit<RunWorkflowOptions, 'session'> {
  /** A roundtable session is constructed ad-hoc from the spec list. */
  templateName: string;
  spec: WorkflowNodeSpec[];
}

/**
 * Run a Roundtable. Returns once every node has settled (done / error /
 * aborted). The `session` returned in the result reflects the final
 * per-node state.
 */
export async function runRoundtable(
  options: RunRoundtableOptions,
): Promise<RunWorkflowResult> {
  const { spec, userQuestion, contextContent, resolveProvider, callbacks, signal } = options;

  const now = Date.now();
  const session: import('./types').WorkflowSession = {
    id: crypto.randomUUID(),
    type: 'roundtable',
    title: options.templateName,
    createdAt: now,
    updatedAt: now,
    contextId: null,
    nodes: initRuntimeNodes(spec),
    status: 'running',
  };
  callbacks?.onSessionStatus?.('running');

  const contextPrefix = buildContextPrefix(contextContent);

  const tasks = session.nodes.map(async (node) => {
    if (signal?.aborted) {
      markAborted(node, callbacks);
      return;
    }

    let providerCfg: ProviderConfig;
    try {
      providerCfg = resolveProviderOrThrow(node.providerId, resolveProvider);
    } catch (err) {
      const e = err as Error & { code?: string };
      markError(node, { code: e.code ?? 'UNKNOWN_PROVIDER', message: e.message }, callbacks);
      return;
    }

    markRunning(node, callbacks);

    let output = '';
    let aborted = false;
    try {
      const provider = createProvider(providerCfg);
      await provider.chatStream(
        {
          providerId: providerCfg.id,
          systemPrompt: contextPrefix
            ? `${contextPrefix}\n\n${node.systemPrompt}`
            : node.systemPrompt,
          messages: [{ role: 'user', content: userQuestion }],
          signal,
        },
        (event) => {
          if (event.type === 'delta') {
            output += event.content;
            callbacks?.onNodeDelta?.(node.id, event.content);
          }
        },
      );
      if (signal?.aborted) {
        aborted = true;
      }
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === ABORTED) {
        aborted = true;
      } else {
        markError(node, { code: e.code ?? 'PROVIDER_ERROR', message: e.message }, callbacks);
        return;
      }
    }

    if (aborted) {
      markAborted(node, callbacks);
      return;
    }
    markDone(node, output, callbacks);
  });

  await Promise.all(tasks);

  const allDone = session.nodes.every((n) => n.status === 'done');
  const anyError = session.nodes.some((n) => n.status === 'error');
  const anyAborted = session.nodes.some((n) => n.status === 'aborted');
  const finalStatus = anyError
    ? 'error'
    : anyAborted && !allDone
    ? 'paused'
    : allDone
    ? 'done'
    : 'paused';
  session.status = finalStatus;
  session.updatedAt = Date.now();
  callbacks?.onSessionStatus?.(finalStatus);

  const outputs: Record<string, string> = {};
  for (const n of session.nodes) outputs[n.id] = n.output;
  return {
    session,
    outputs,
    aborted: anyAborted,
  };
}

/** Re-export so consumers don't have to reach into M3 directly. */
export { ABORTED, ProviderError };
