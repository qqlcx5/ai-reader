/**
 * M5 Workflows — Types
 *
 * Core data types for Roundtable and Relay Chain workflow sessions,
 * nodes, templates, and execution callbacks.
 *
 * Based on design-05-workflows.md §3.
 */

// ─── Workflow Session ────────────────────────────────────────────────

export type WorkflowType = 'roundtable' | 'relay';
export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'done' | 'error';
export type WorkflowNodeStatus = 'pending' | 'running' | 'done' | 'error';

export interface WorkflowNode {
  id: string;
  /** Execution order (0-based for Roundtable, linear for Relay) */
  order: number;
  /** Display name */
  name: string;
  /** Provider ID (references M3 provider config) */
  providerId: string;
  /** Role / system prompt injected into the LLM */
  systemPrompt: string;
  /** Upstream node IDs whose outputs feed into this node (Relay Chain) */
  upstreamNodeIds: string[];
  /** Accumulated LLM output */
  output?: string;
  /** Current execution status */
  status: WorkflowNodeStatus;
  /** Error details if status === 'error' */
  error?: { code: string; message: string; at: number };
}

export interface WorkflowSession {
  id: string;
  type: WorkflowType;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Associated extraction context ID */
  contextId: string | null;
  /** Participating nodes */
  nodes: WorkflowNode[];
  /** Overall execution status */
  status: WorkflowStatus;
}

// ─── Workflow Template ───────────────────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  type: WorkflowType;
  description?: string;
  /** Template nodes without runtime state */
  nodes: Omit<WorkflowNode, 'output' | 'status' | 'error'>[];
  createdAt: number;
  updatedAt: number;
}

// ─── Execution Context ───────────────────────────────────────────────

export interface WorkflowContext {
  /** Extracted page text used as background context */
  pageText: string | null;
  /** Page title/URL for context prefix */
  pageTitle: string;
  pageUrl: string;
}

// ─── Callbacks ───────────────────────────────────────────────────────

export interface WorkflowCallbacks {
  /** Called when a node's status changes */
  onNodeStatus: (nodeId: string, status: WorkflowNodeStatus) => void;
  /** Called for each delta chunk from a node's LLM stream */
  onNodeDelta: (nodeId: string, delta: string) => void;
  /** Called when the entire workflow finishes (success or error) */
  onWorkflowDone: (status: WorkflowStatus, error?: string) => void;
}

// ─── Default Templates ───────────────────────────────────────────────

export const DEFAULT_ROUNDTABLE_TEMPLATE: Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Default Debate',
  type: 'roundtable',
  description: 'Two roles debate the user question from opposing perspectives.',
  nodes: [
    {
      id: 'role-a',
      order: 0,
      name: '正方 / Proponent',
      providerId: '',
      systemPrompt: 'You are a persuasive advocate. Argue strongly in favor of the following proposition. Use evidence and logical reasoning.',
      upstreamNodeIds: [],
    },
    {
      id: 'role-b',
      order: 1,
      name: '反方 / Critic',
      providerId: '',
      systemPrompt: 'You are a skeptical critic. Challenge the proposition from every angle. Identify flaws, assumptions, and counterarguments.',
      upstreamNodeIds: [],
    },
  ],
};

export const DEFAULT_RELAY_TEMPLATE: Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Summarize → Translate',
  type: 'relay',
  description: 'First node summarizes, second node translates the summary.',
  nodes: [
    {
      id: 'step-summarize',
      order: 0,
      name: 'Summarize',
      providerId: '',
      systemPrompt: 'Summarize the input concisely in 3-5 bullet points.',
      upstreamNodeIds: [],
    },
    {
      id: 'step-translate',
      order: 1,
      name: 'Translate',
      providerId: '',
      systemPrompt: 'Translate the following text into Chinese. Preserve all key information.',
      upstreamNodeIds: ['step-summarize'],
    },
  ],
};
