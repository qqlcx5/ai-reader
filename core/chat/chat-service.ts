/**
 * 聊天服务
 * 参考 doc/tasks/chat-with-doc.md 章节 2, 3, 7
 * 协调：prompt 构建 → 模型调用 → 流式转发 → 持久化
 */
import type {
  ChatHistory,
  ChatMessage,
  ModelProviderConfig,
  CapturedDocument,
} from '@/shared/types';
import { getModel, listEnabledModels } from '@/db/model-repository';
import { getAppSettings } from '@/db/dexie';
import { getDocument } from '@/db/document-repository';
import {
  newChatHistoryId,
  newMessageId,
  putChatHistory,
  appendMessage,
  appendDelta,
} from '@/db/chat-repository';
import { streamChat } from '@/core/models/openai-compat.adapter';

const DEFAULT_SYSTEM_PROMPT = `你是一个专业、严谨的阅读助手。用户会给你一篇捕获的网页内容，请基于内容回答用户的问题。

规则：
1. 优先使用文章中的事实和数据
2. 回答要简洁、结构化
3. 引用具体段落时使用引用块
4. 如果文章没有相关信息，明确告知
5. 回答使用用户提问的语言`;

/**
 * 构建 prompt
 * 参考 doc/tasks/chat-with-doc.md 章节 2
 */
export function buildPromptMessages(
  doc: CapturedDocument,
  history: ChatMessage[],
  question: string,
  model?: ModelProviderConfig
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // 1. 系统提示词：模型专属 > 全局默认 > 内置默认
  const systemPrompt =
    model?.systemPrompt ||
    /* global default will be loaded by caller */ DEFAULT_SYSTEM_PROMPT;
  messages.push({
    id: 'system',
    role: 'system',
    content: systemPrompt,
    createdAt: Date.now(),
  });

  // 2. 文档内容 + 问题
  // 截断策略：超长文档保留前 N tokens（粗略按字符数估算）
  const truncatedDoc = truncateForContext(doc.markdownContent, 16000);
  const userContent = `【文档标题】${doc.title}\n【文档 URL】${doc.url}\n【文档内容】\n${truncatedDoc}\n\n【问题】${question}`;
  messages.push({
    id: 'q',
    role: 'user',
    content: userContent,
    createdAt: Date.now(),
  });

  // 3. 历史（保留最近几轮）
  for (const m of history.slice(-6)) {
    messages.push(m);
  }

  return messages;
}

function truncateForContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n...(内容已截断)...';
}

/**
 * 启动一次聊天（流式）
 * 参考 doc/tasks/chat-with-doc.md 章节 3
 */
export interface StartChatOptions {
  documentId: string;
  question: string;
  modelId?: string;
  onChunk: (delta: string, done: boolean) => void;
  signal?: AbortSignal;
}

export async function startChat(opts: StartChatOptions): Promise<{
  historyId: string;
}> {
  // 1. 获取文档
  const doc = await getDocument(opts.documentId);
  if (!doc) throw new Error('Document not found');

  // 2. 选择模型
  const model = await resolveModel(opts.modelId);
  if (!model) throw new Error('No available model');

  // 3. 创建历史记录
  const historyId = newChatHistoryId();
  const now = Date.now();
  const userMsg: ChatMessage = {
    id: newMessageId(),
    role: 'user',
    content: opts.question,
    createdAt: now,
  };
  const assistantMsg: ChatMessage = {
    id: newMessageId(),
    role: 'assistant',
    content: '',
    createdAt: now,
    pending: true,
  };

  const initialHistory: ChatHistory = {
    id: historyId,
    documentId: doc.id,
    modelId: model.id,
    model: model.name,
    title: opts.question.slice(0, 50),
    messages: [userMsg, assistantMsg],
    createdAt: now,
    updatedAt: now,
  };
  await putChatHistory(initialHistory);

  // 4. 构建 messages
  const messages = buildPromptMessages(doc, [], opts.question, model);

  // 5. 流式调用
  try {
    const stream = streamChat(
      { model, messages, temperature: 0.7 },
      { signal: opts.signal }
    );
    for await (const chunk of stream) {
      if (chunk.delta) {
        await appendDelta(historyId, chunk.delta);
        opts.onChunk(chunk.delta, false);
      }
      if (chunk.done) {
        // 标记完成
        const hist = await import('@/db/chat-repository').then((m) =>
          m.getChatHistory(historyId)
        );
        if (hist) {
          const last = hist.messages[hist.messages.length - 1];
          if (last && last.pending) {
            last.pending = false;
            hist.updatedAt = Date.now();
            await putChatHistory(hist);
          }
        }
        opts.onChunk('', true);
        break;
      }
    }
  } catch (err) {
    // 标记消息错误
    const hist = await import('@/db/chat-repository').then((m) =>
      m.getChatHistory(historyId)
    );
    if (hist) {
      const last = hist.messages[hist.messages.length - 1];
      if (last) {
        last.error = true;
        last.pending = false;
        last.content = (last.content || '') + `\n\n[错误] ${err instanceof Error ? err.message : String(err)}`;
        hist.updatedAt = Date.now();
        await putChatHistory(hist);
      }
    }
    throw err;
  }

  return { historyId };
}

/**
 * 解析要使用的模型
 */
async function resolveModel(modelId?: string): Promise<ModelProviderConfig | undefined> {
  if (modelId) {
    const m = await getModel(modelId);
    if (m && m.enabled) return m;
  }
  // 1. 尝试默认模型
  const settings = await getAppSettings();
  if (settings.defaultModelId) {
    const m = await getModel(settings.defaultModelId);
    if (m && m.enabled) return m;
  }
  // 2. 用第一个启用的模型
  const enabled = await listEnabledModels();
  return enabled[0];
}
