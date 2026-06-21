/**
 * M6 — Export view models.
 *
 * The M7 storage layer stores conversations as metadata-only
 * `ConversationRecord`s and messages as `MessageRecord`s whose body is a
 * `modelResponses[]` array (one entry per provider). Export consumers
 * (markdown renderer, zip worker, backup JSON) want a *flattened* shape:
 * one `Message` per turn with a single `role` / `content` / provider
 * meta. These view models bridge that gap without leaking Dexie-specific
 * record structure into the export surface.
 */
import type {
  ConversationRecord,
  MessageRecord,
  ModelResponse,
} from '@/modules/storage/types';

/**
 * Flattened conversation used only for export / rendering.
 * `url` and `mode` are convenient denormalizations of the source page.
 */
export interface Conversation {
  id: string;
  title: string;
  mode: ConversationRecord['mode'];
  url?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Flattened message used only for export / rendering.
 * For assistant turns that carry multiple provider responses, only the
 * first response is surfaced here (the full set remains in the backup
 * JSON via the underlying `MessageRecord`).
 */
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRecord['role'];
  content: string;
  providerId?: string;
  providerName?: string;
  model?: string;
  createdAt: number;
}

/** Map a stored conversation record to the export view model. */
export function toConversation(record: ConversationRecord): Conversation {
  return {
    id: record.id,
    title: record.title,
    mode: record.mode,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function firstResponse(responses: ModelResponse[] | undefined) {
  return responses && responses.length > 0 ? responses[0] : undefined;
}

/**
 * Map a stored message record to one or more export view-model messages.
 *
 * User / system messages map 1:1. Assistant messages map 1:1 per provider
 * response; when there is exactly one response (the common multi-model
 * fan-out case still produces a single composite record per turn) we keep
 * it as a single flattened entry.
 */
export function toMessages(record: MessageRecord): Message[] {
  const base: Message = {
    id: record.id,
    conversationId: record.conversationId,
    role: record.role,
    content: record.content ?? '',
    createdAt: record.createdAt,
  };

  if (record.role !== 'assistant' || !record.modelResponses?.length) {
    return [base];
  }

  // Single response (typical): keep id stable so re-import can match.
  const first = firstResponse(record.modelResponses);
  if (record.modelResponses.length === 1 && first) {
    return [
      {
        ...base,
        content: first.content ?? base.content,
        providerId: first.providerId,
        providerName: providerNameFromId(first.providerId),
        model: first.modelId,
        createdAt: first.createdAt ?? base.createdAt,
      },
    ];
  }

  // Multiple responses: emit one entry per provider with a derived id.
  return record.modelResponses.map((r, i) => ({
    ...base,
    id: `${record.id}#${i}`,
    content: r.content ?? '',
    providerId: r.providerId,
    providerName: providerNameFromId(r.providerId),
    model: r.modelId,
    createdAt: r.createdAt ?? base.createdAt,
  }));
}

/**
 * Best-effort human provider name. The authoritative name lives on the
 * `ProviderConfig`; we don't have it here, so we surface the id prefixed
 * with a label. Callers that need the real name can post-process.
 */
function providerNameFromId(providerId: string | undefined): string | undefined {
  return providerId;
}

/** Map all stored records to export view models in one pass. */
export function toExportModels(
  conversations: ConversationRecord[],
  messages: MessageRecord[],
): { conversations: Conversation[]; messages: Message[] } {
  return {
    conversations: conversations.map(toConversation),
    messages: messages.flatMap(toMessages),
  };
}
