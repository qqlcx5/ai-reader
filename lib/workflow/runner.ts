/**
 * M5 — Internal helpers shared by roundtable.ts and relay.ts.
 */
import { createProvider, type ProviderConfig, ProviderError, ABORTED } from '@/modules/provider';
import type { WorkflowNodeSpec, WorkflowRuntimeNode, WorkflowSession, WorkflowCallbacks } from './types';

/** Build the common system-prompt prefix that injects page context. */
export function buildContextPrefix(contextContent: string | null | undefined): string {
  if (!contextContent) return '';
  const trimmed = contextContent.length > 8000 ? `${contextContent.slice(0, 8000)}…` : contextContent;
  return `[Context from current page]\n${trimmed}`;
}

/** Look up a provider config and throw a clear error if it's missing. */
export function resolveProviderOrThrow(
  providerId: string,
  resolveProvider: (id: string) => ProviderConfig | null,
): ProviderConfig {
  const cfg = resolveProvider(providerId);
  if (!cfg) {
    throw new ProviderError('UNKNOWN_PROVIDER', `Provider "${providerId}" is not configured`);
  }
  if (!cfg.enabled) {
    throw new ProviderError('PROVIDER_DISABLED', `Provider "${providerId}" is disabled`);
  }
  return cfg;
}

/** Build the user message body that gets stitched into a Relay node. */
export function buildRelayInput(args: {
  initialInput: string;
  upstreamOutputs: Map<string, string>;
  upstreamNodeIds: string[];
  upstreamNames: Map<string, string>;
  contextContent?: string | null;
}): string {
  const parts: string[] = [];
  if (args.contextContent) {
    parts.push(`[Context]\n${args.contextContent}`);
  }
  parts.push(`[Original Input]\n${args.initialInput}`);
  for (const id of args.upstreamNodeIds) {
    const out = args.upstreamOutputs.get(id);
    if (!out) continue;
    const name = args.upstreamNames.get(id) ?? id;
    parts.push(`[Output from ${name}]\n${out}`);
  }
  return parts.join('\n\n---\n\n');
}

/** Mark a node as `running` and notify subscribers. */
export function markRunning(node: WorkflowRuntimeNode, cb?: WorkflowCallbacks) {
  node.status = 'running';
  cb?.onNodeStatus?.(node.id, 'running');
}

/** Mark a node as `done`, persist its accumulated output, and notify. */
export function markDone(node: WorkflowRuntimeNode, output: string, cb?: WorkflowCallbacks) {
  node.output = output;
  node.status = 'done';
  node.error = undefined;
  cb?.onNodeStatus?.(node.id, 'done');
}

/** Mark a node as `error` and notify. */
export function markError(
  node: WorkflowRuntimeNode,
  err: { code: string; message: string },
  cb?: WorkflowCallbacks,
) {
  node.status = 'error';
  node.error = err;
  cb?.onNodeStatus?.(node.id, 'error', err);
}

/** Mark a node as `aborted` and notify. */
export function markAborted(node: WorkflowRuntimeNode, cb?: WorkflowCallbacks) {
  node.status = 'aborted';
  cb?.onNodeStatus?.(node.id, 'aborted');
}

export function newRuntimeNode(spec: WorkflowNodeSpec): WorkflowRuntimeNode {
  return {
    ...spec,
    output: '',
    status: 'pending',
  };
}

export function initRuntimeNodes(specs: WorkflowNodeSpec[]): WorkflowRuntimeNode[] {
  return specs.map(newRuntimeNode);
}

export { ABORTED };

export type { ProviderConfig, WorkflowNodeSpec, WorkflowRuntimeNode, WorkflowSession, WorkflowCallbacks };
