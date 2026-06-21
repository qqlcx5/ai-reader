/**
 * M5 High-Level AI Workflows — Unified Export
 *
 * Provides the workflow orchestration engine for Roundtable (parallel
 * multi-role debate) and Relay Chain (sequential pipeline) workflows.
 *
 * Based on design-05-workflows.md.
 */

// ─── Types ────────────────────────────────────────────────────────────

export type {
  WorkflowType,
  WorkflowStatus,
  WorkflowNodeStatus,
  WorkflowNode,
  WorkflowSession,
  WorkflowTemplate,
  WorkflowContext,
  WorkflowCallbacks,
} from './types';

export {
  DEFAULT_ROUNDTABLE_TEMPLATE,
  DEFAULT_RELAY_TEMPLATE,
} from './types';

// ─── Orchestrator ─────────────────────────────────────────────────────

export {
  generateSessionId,
  createSessionFromTemplate,
  createSession,
  executeWorkflow,
  addNodeToSession,
  removeNodeFromSession,
  validateSession,
} from './orchestrator';

// ─── Roundtable ───────────────────────────────────────────────────────

export { runRoundtable } from './roundtable';

// ─── Relay Chain ──────────────────────────────────────────────────────

export { runRelayChain } from './relay';

// ─── Template Store ──────────────────────────────────────────────────

export {
  loadTemplates,
  getAllTemplates,
  getTemplatesByType,
  getTemplateById,
  addTemplate,
  updateTemplate,
  removeTemplate,
  generateTemplateId,
} from './template-store';
