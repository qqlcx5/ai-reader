// M4 - Multi-Model Workspace public surface.
//
// Canonical location: lib/workspace/. Lives outside modules/ to avoid
// WXT auto-discovery of modules entries as user modules.
export type {
  Conversation,
  ConversationMode,
  ConversationBranch,
  Message,
  MessageRole,
  ModelResponseStatus,
  RunRequest,
  RunResult,
  SchedulerCallbacks,
} from './types';
export { runMultiModelChat, runSingleModel, diffModelResponses } from './scheduler';
export { buildSystemPrompt, buildHistoryMessages } from './buildSystemPrompt';
