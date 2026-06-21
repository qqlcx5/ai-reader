/**
 * M4 — Cherry-style Multi-Model Chat Workspace
 * Type definitions.
 *
 * 这些类型与 modules/storage/types.ts 中的 ConversationRecord/MessageRecord 配套：
 *   - storage 层负责「物理持久化」(IndexedDB 主副表)
 *   - workspace 层负责「逻辑运行时」(UI 状态、调度、状态机)
 */

import type { RequestMetrics, ChatMessage, ProviderConfig } from '@/modules/provider';
import type { ExtractedContext } from '@/modules/extraction';

export type ConversationMode = 'chat' | 'roundtable' | 'relay';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** 当前分支的根消息 ID */
  rootMessageId?: string;
  /** 参与本次会话的 Provider ID 列表（来自 Settings.providers） */
  activeProviderIds: string[];
  mode: ConversationMode;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ModelResponseStatus {
  providerId: string;
  status: 'pending' | 'streaming' | 'done' | 'error' | 'aborted';
  content: string;
  metrics: RequestMetrics | null;
  error?: { code: string; message: string };
  /** 下游分支会话 ID（用于「以此继续」） */
  branchConversationId?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: MessageRole;
  /** 用户发送的原始内容 */
  content?: string;
  /** 助手消息按 Provider 的回复 */
  modelResponses: ModelResponseStatus[];
  createdAt: number;
}

/** 单分支追问追踪 */
export interface ConversationBranch {
  branchId: string;
  parentConversationId: string;
  parentMessageId: string;
  sourceProviderId: string;
  sourceModelResponseId: string;
}

/** 调度器回调 */
export interface SchedulerCallbacks {
  onDelta: (providerId: string, delta: string) => void;
  onStatus: (providerId: string, status: ModelResponseStatus['status']) => void;
  onMetrics: (providerId: string, metrics: RequestMetrics) => void;
  onError: (providerId: string, error: { code: string; message: string }) => void;
}

/** 调度请求输入 */
export interface RunRequest {
  conversation: Conversation;
  userMessage: Message;
  providers: ProviderConfig[];
  context: ExtractedContext | null;
  callbacks: SchedulerCallbacks;
  /** 当整个会话被中止时使用的共享 signal */
  signal?: AbortSignal;
}

/** 调度结果 */
export interface RunResult {
  providerId: string;
  status: 'done' | 'error' | 'aborted';
  metrics: RequestMetrics | null;
  error?: { code: string; message: string };
}

export type { ChatMessage, ProviderConfig, RequestMetrics, ExtractedContext };
