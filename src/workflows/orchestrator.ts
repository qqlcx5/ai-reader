/**
 * M5 Workflows — Session Orchestrator
 *
 * Manages workflow session lifecycle: creation, execution dispatch,
 * and template instantiation. Acts as the top-level API that entry
 * points (M1, M4) call to launch workflows.
 *
 * Based on design-05-workflows.md §4-5.
 */

import type {
  WorkflowSession,
  WorkflowNode,
  WorkflowTemplate,
  WorkflowType,
  WorkflowContext,
  WorkflowCallbacks,
} from './types';
import { runRoundtable } from './roundtable';
import { runRelayChain } from './relay';

// ─── Session Management ──────────────────────────────────────────────

/** Generate a unique session ID */
export function generateSessionId(): string {
  return `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a new workflow session from a template */
export function createSessionFromTemplate(
  template: WorkflowTemplate,
  contextId: string | null,
): WorkflowSession {
  const nodes: WorkflowNode[] = template.nodes.map((n, i) => ({
    ...n,
    order: n.order ?? i,
    status: 'pending' as const,
    output: undefined,
    error: undefined,
  }));

  const now = Date.now();

  return {
    id: generateSessionId(),
    type: template.type,
    title: template.name,
    createdAt: now,
    updatedAt: now,
    contextId,
    nodes,
    status: 'idle',
  };
}

/** Create a session from scratch (no template) */
export function createSession(
  type: WorkflowType,
  title: string,
  nodes: Omit<WorkflowNode, 'output' | 'status' | 'error'>[],
  contextId: string | null,
): WorkflowSession {
  const now = Date.now();
  return {
    id: generateSessionId(),
    type,
    title,
    createdAt: now,
    updatedAt: now,
    contextId,
    nodes: nodes.map((n, i) => ({
      ...n,
      order: n.order ?? i,
      status: 'pending' as const,
      output: undefined,
      error: undefined,
    })),
    status: 'idle',
  };
}

// ─── Execution ───────────────────────────────────────────────────────

/**
 * Execute a workflow session. Dispatches to roundtable or relay
 * based on session.type.
 *
 * @param session - The workflow session to execute
 * @param userQuestion - The user's question or input text
 * @param context - Extracted page context (from M2)
 * @param callbacks - Callbacks for UI updates
 */
export async function executeWorkflow(
  session: WorkflowSession,
  userQuestion: string,
  context: WorkflowContext | null,
  callbacks: WorkflowCallbacks,
): Promise<void> {
  session.status = 'running';
  session.updatedAt = Date.now();

  try {
    switch (session.type) {
      case 'roundtable':
        await runRoundtable(session, userQuestion, context, callbacks);
        break;
      case 'relay':
        await runRelayChain(session, userQuestion, context, callbacks);
        break;
      default:
        throw new Error(`Unknown workflow type: ${session.type}`);
    }

    // Determine final status from nodes
    const hasError = session.nodes.some((n) => n.status === 'error');
    session.status = hasError ? 'error' : 'done';
  } catch (err) {
    session.status = 'error';
    callbacks.onWorkflowDone('error', err instanceof Error ? err.message : String(err));
  } finally {
    session.updatedAt = Date.now();
  }
}

// ─── Node Management ─────────────────────────────────────────────────

/** Add a node to an existing session */
export function addNodeToSession(
  session: WorkflowSession,
  node: Omit<WorkflowNode, 'output' | 'status' | 'error'>,
): void {
  session.nodes.push({
    ...node,
    status: 'pending',
    output: undefined,
    error: undefined,
  });
  session.updatedAt = Date.now();
}

/** Remove a node from a session */
export function removeNodeFromSession(session: WorkflowSession, nodeId: string): void {
  session.nodes = session.nodes.filter((n) => n.id !== nodeId);
  // Also remove this node from any upstream references
  for (const node of session.nodes) {
    node.upstreamNodeIds = node.upstreamNodeIds.filter((id) => id !== nodeId);
  }
  session.updatedAt = Date.now();
}

/** Validate a session is ready to execute */
export function validateSession(session: WorkflowSession): string | null {
  if (session.nodes.length === 0) return 'At least one node is required';
  if (session.nodes.some((n) => !n.providerId)) return 'All nodes must have a provider configured';
  if (session.nodes.some((n) => !n.systemPrompt)) return 'All nodes must have a system prompt';

  if (session.type === 'relay' && session.nodes.length < 2) {
    return 'Relay chain requires at least 2 nodes';
  }

  return null;
}
