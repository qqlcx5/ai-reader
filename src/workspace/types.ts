/**
 * Workspace module — Core types
 *
 * Conversation, Message, ModelResponse, and branching data structures.
 * Based on design-04-workspace.md.
 */

import type { RequestMetrics, StreamEvent } from '../providers/types';

// ─── Conversation ────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Root message ID for the current branch */
  rootMessageId: string;
  /** Active provider IDs in this conversation */
  activeProviderIds: string[];
  /** Conversation mode */
  mode: ConversationMode;
}

export type ConversationMode = 'chat' | 'roundtable' | 'relay';

// ─── Message ─────────────────────────────────────────────────────────

export interface Message {
  id: string;
  conversationId: string;
  /** Parent message ID for branching */
  parentId: string | null;
  role: 'user' | 'assistant';
  /** User's original content */
  content?: string;
  /** Multi-model responses (empty for user messages) */
  modelResponses: ModelResponse[];
  createdAt: number;
}

// ─── Model Response ──────────────────────────────────────────────────

export interface ModelResponse {
  providerId: string;
  model: string;
  status: ResponseStatus;
  /** Accumulated generated text */
  content: string;
  /** Performance metrics (from M3) */
  metrics: ResponseMetrics;
  /** Error details */
  error?: ResponseError;
  /** Branch conversation ID (for "continue with this" feature) */
  branchConversationId?: string;
}

export type ResponseStatus =
  | 'pending'
  | 'streaming'
  | 'done'
  | 'error'
  | 'aborted';

export interface ResponseMetrics {
  startTime: number;
  firstTokenTime: number | null;
  endTime: number | null;
  totalLatency: number | null;
  tokensPerSecond: number | null;
  estimatedCost: number | null;
}

export interface ResponseError {
  code: string;
  message: string;
  retryable: boolean;
}

// ─── Branch ──────────────────────────────────────────────────────────

export interface ConversationBranch {
  branchId: string;
  parentConversationId: string;
  parentMessageId: string;
  sourceProviderId: string;
  sourceModelResponseId: string;
}

// ─── Workspace State ─────────────────────────────────────────────────

export interface WorkspaceState {
  /** Current active conversation */
  conversationId: string | null;
  /** Message history (ordered) */
  messages: Message[];
  /** Currently loading message IDs */
  loadingMessageIds: Set<string>;
  /** Rendered HTML cache: messageId → html */
  renderCache: Map<string, string>;
  /** Provider IDs being streamed */
  streamingProviderIds: Set<string>;
  /** Global abort signal */
  abortSignal: AbortSignal | null;
}

// ─── Scheduler Callbacks ─────────────────────────────────────────────

export interface SchedulerCallbacks {
  /** Called for each delta from a provider */
  onDelta: (providerId: string, delta: string) => void;
  /** Called when provider status changes */
  onStatus: (providerId: string, status: ResponseStatus) => void;
  /** Called when metrics update (usage event or stream end) */
  onMetrics: (providerId: string, metrics: ResponseMetrics) => void;
  /** Called when a provider encounters an error */
  onError: (providerId: string, error: ResponseError) => void;
}

// ─── Factory Utilities ───────────────────────────────────────────────

let counter = 0;

export function generateId(prefix: string): string {
  counter = (counter + 1) % 100000;
  return `${prefix}_${Date.now()}_${counter}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyMetrics(): ResponseMetrics {
  return {
    startTime: Date.now(),
    firstTokenTime: null,
    endTime: null,
    totalLatency: null,
    tokensPerSecond: null,
    estimatedCost: null,
  };
}

export function createModelResponse(
  providerId: string,
  model: string,
): ModelResponse {
  return {
    providerId,
    model,
    status: 'pending',
    content: '',
    metrics: createEmptyMetrics(),
  };
}
