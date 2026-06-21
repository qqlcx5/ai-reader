/**
 * M5 — Advanced Workflows: public types.
 *
 * The runtime session types here are intentionally aligned with the
 * persisted M7 types so that a workflow session can be flattened into
 * ConversationRecord / MessageRecord without lossy conversions.
 */
import type { ProviderConfig } from '@/modules/provider';

export type WorkflowType = 'roundtable' | 'relay';

export type WorkflowNodeStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'error'
  | 'aborted';

export type WorkflowSessionStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'done'
  | 'error';

/** Static description of a node (matches the persisted template shape). */
export interface WorkflowNodeSpec {
  id: string;
  order: number;
  name: string;
  providerId: string;
  systemPrompt: string;
  upstreamNodeIds: string[];
}

/** A node being executed, mutated in place by the runner. */
export interface WorkflowRuntimeNode extends WorkflowNodeSpec {
  output: string;
  status: WorkflowNodeStatus;
  error?: { code: string; message: string };
}

/** Persisted template; sessions themselves are not stored — they are
 *  re-built on the fly and their results land in the conversations table. */
export interface WorkflowTemplate {
  id: string;
  name: string;
  type: WorkflowType;
  description?: string;
  nodes: WorkflowNodeSpec[];
  builtIn: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowSession {
  id: string;
  type: WorkflowType;
  title: string;
  createdAt: number;
  updatedAt: number;
  contextId: string | null;
  nodes: WorkflowRuntimeNode[];
  status: WorkflowSessionStatus;
}

export interface WorkflowCallbacks {
  onNodeStatus?: (nodeId: string, status: WorkflowNodeStatus, error?: { code: string; message: string }) => void;
  onNodeDelta?: (nodeId: string, delta: string) => void;
  onSessionStatus?: (status: WorkflowSessionStatus) => void;
}

export interface RunWorkflowOptions {
  session: WorkflowSession;
  userQuestion: string;
  /** Optional page context, joined onto the system prompt. */
  contextContent?: string | null;
  /** A function that maps a providerId to a ready-to-use provider config. */
  resolveProvider: (providerId: string) => ProviderConfig | null;
  callbacks?: WorkflowCallbacks;
  signal?: AbortSignal;
}

export interface RunWorkflowResult {
  session: WorkflowSession;
  /** Map of nodeId → final output. */
  outputs: Record<string, string>;
  aborted: boolean;
}
