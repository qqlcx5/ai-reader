/**
 * Workspace Module — Unified Export
 *
 * Provides:
 * - Conversation state management types
 * - Multi-model scheduler (1-4 concurrent models)
 * - Streaming renderer with rAF throttling
 * - Branch conversation support
 *
 * Based on design-04-workspace.md.
 */

// ─── Scheduler ────────────────────────────────────────────────────────

export {
  runMultiModelChat,
  runSingleModelChat,
} from './scheduler';

// ─── Renderer ─────────────────────────────────────────────────────────

export {
  StreamingRenderer,
  createMarkdownRenderer,
  createFpsMonitor,
  onRender,
} from './renderer';
export type { RendererConfig, RenderFunction } from './renderer';

// ─── Branch ───────────────────────────────────────────────────────────

export {
  createBranchConversation,
  getBranchContextChain,
  buildBranchMessages,
  hasBranchDescendants,
  getBranchesForConversation,
} from './branch';

// ─── Types ────────────────────────────────────────────────────────────

export type {
  Conversation,
  ConversationMode,
  Message,
  ModelResponse,
  ResponseStatus,
  ResponseMetrics,
  ResponseError,
  ConversationBranch,
  WorkspaceState,
  SchedulerCallbacks,
} from './types';

export {
  generateId,
  createEmptyMetrics,
  createModelResponse,
} from './types';
