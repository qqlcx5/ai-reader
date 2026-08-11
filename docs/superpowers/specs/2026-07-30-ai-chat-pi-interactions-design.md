# AI Chat Pi-style Interactions Design

## Scope

Improve the existing AI chat experience with three focused capabilities:

1. Allow messages to be queued while a model is generating. Queued messages use Pi-like steering semantics: after the current generation finishes, messages are sent in FIFO order.
2. Add a conversation history tree with branch and restore-to-node actions.
3. Make reasoning, model, request, and queue states explicit and easy to scan.

Tool execution is explicitly out of scope.

## Existing Context

The current implementation already supports:

- Streaming assistant responses.
- Per-conversation stream state and background streaming when switching conversations.
- Multiple models in one round.
- Collapsible reasoning content.
- Regenerate, edit, delete, copy, and branch-from-message actions.
- Conversation persistence through IndexedDB.

The implementation must preserve these behaviors and remain compatible with existing conversations.

## Design

### 1. Steering Queue

The chat store will own a per-conversation steering queue. A queued item contains a stable id, the raw user content, creation time, and the selected model configuration ids at the time of enqueueing.

When no request is active, sending keeps the existing immediate-send behavior. When the current conversation is sending or streaming, the input remains usable and the primary action changes to enqueue. Enqueueing clears the input and adds the item to the current conversation's queue.

After a send completes successfully, the store consumes the first queued item and sends it as the next normal chat turn. Consumption is sequential and never concurrent. The existing multi-model selection is preserved for each queued item by storing model ids with the item.

When a request fails or is stopped, automatic queue consumption pauses. Queued items remain available for retry, deletion, or later continuation. Stopping the current generation must not discard queued messages.

Queue state is isolated per conversation. It is persisted as an optional field on `ConversationEntity`, so old records without the field load as an empty queue. Persistence must happen when enqueueing, removing, consuming, switching conversations, and before leaving the active conversation.

The input area will show the queue count and provide a compact queue popover/list. Each item can be removed individually. The UI will distinguish `发送` from `加入队列` through label, icon, and accessible title.

### 2. Conversation History Tree

A history node represents a message boundary. The node stores a stable id, the message id at that boundary, an optional parent node id, and creation time. Existing linear conversations are treated as a single root path when no node metadata exists.

The existing branch action remains the entry point for creating a new path. Branching at a message creates a new `ConversationEntity` with messages through that message and records the new conversation's root/history metadata. The original conversation is unchanged.

The restore action truncates the current visible path to the selected message boundary, but first preserves the original path as a branch snapshot. This prevents destructive loss and makes the operation reversible through the history tree. Restoring does not delete stored messages from the original path.

A history tree panel will be opened from the conversation actions/header. It will show:

- Current conversation and its branch relationships.
- Message preview, role, and timestamp for each node.
- The active node/path.
- Actions to restore to a node or create a branch from a node.

The tree is a conversation navigation surface, not a separate editor. Selecting a node alone does not mutate messages; restore or branch is explicit.

History metadata is optional and additive. Existing conversations remain readable and are represented as a linear path without a migration requirement.

### 3. Explicit Runtime States

Runtime status is represented at two levels:

- Request/conversation level: idle, generating, paused, or failed.
- Assistant message level: pending, sending, reasoning, streaming, success, failed, or aborted.

The current message status field remains the source of truth for individual responses. Reasoning content continues to be collapsible. While reasoning content is arriving, the assistant header displays a compact `思考中` state; once answer tokens arrive it changes to `生成中`.

The active model name is shown alongside the request state. In multi-model rounds, each assistant response displays its own model and state; no single global label may hide a model-specific failure.

The generation footer shows elapsed/request state and the number of queued steering messages. Stop remains available during generation. Failed and paused states expose a retry/continue affordance without removing queued items.

No tool-specific states, events, or UI are added.

## Data Flow

```text
Input
  -> no active request: send immediately
  -> active request: append steering item for current conversation

Request completion
  -> persist response
  -> if queue has items: consume first item
  -> send next item sequentially
  -> otherwise return to idle

History action
  -> inspect node
  -> explicit branch or restore
  -> preserve original path
  -> continue from selected path
```

## Error Handling

- An empty queued message is rejected.
- If a model referenced by a queued item is deleted or disabled, that item is not silently dropped; it becomes an actionable failed queue item with a clear error.
- If IndexedDB persistence fails, the current UI remains usable and the existing error logging behavior is retained. The queue UI indicates that persistence is unavailable only if the existing app error surface supports it.
- If a stream is aborted, assistant messages become `aborted` and the queue remains paused.
- Switching conversations preserves the active stream and queue state of the previous conversation.
- Restoring a node does not delete the source conversation or its stored branch.

## Implementation Boundaries

Expected production changes are limited to:

- `types/chat.ts`: optional queue and history metadata types/fields.
- `stores/chat.store.ts`: queue lifecycle, sequential consumption, persistence, and restore/branch coordination.
- `components/auramind/ChatInput.vue`: enqueue behavior and queue list.
- `components/auramind/ChatView.vue`: request/queue status display and history entry point.
- `components/workspace/ChatMessage.vue`: explicit reasoning/generation/status labels and restore action.
- `components/workspace/ConversationList.vue`: conversation tree access and branch indicators.
- Focused tests for queue ordering, stop/failure retention, per-conversation isolation, backward-compatible loading, and restore/branch behavior.

No provider, tool protocol, document context, or unrelated visual system changes are included.

## Verification Criteria

- A user can type and enqueue one or more messages while a response streams.
- Queued messages are sent one at a time in FIFO order after successful completion.
- Stopping or failing a request leaves queued messages intact and visibly paused.
- Switching conversations does not mix queues or statuses.
- Existing conversations without new metadata still load and render correctly.
- Branching preserves the source conversation.
- Restoring a node preserves the prior path and allows continued conversation from the restored point.
- Reasoning, generation, completion, failure, stopped, and queued states are distinguishable in the UI.
- Existing chat, branching, persistence, and component tests remain passing, with new focused tests covering the added behavior.
