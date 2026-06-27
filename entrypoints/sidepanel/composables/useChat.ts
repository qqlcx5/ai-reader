// ============================================================
// useChat — Chat state management composable
// ============================================================

import { ref, computed } from 'vue';
import { chatRepo } from '@/db/chat.repository';
import { modelConfigRepo } from '@/db/model-config.repository';
import type { ChatSession, ChatMessage } from '@/db/schema';
import { streamChatCompletion, type StreamError } from '@/core/chat/sse-client';
import { buildWorkflowPrompts, type WorkflowType, getWorkflow } from '@/core/chat/workflow-prompts';

export type AIStatus = 'idle' | 'generating' | 'done' | 'error';

export interface ChatState {
  sessionId: string | null;
  articleId: string | null;
  workflow: WorkflowType | null;
  messages: ChatMessage[];
  status: AIStatus;
  streamContent: string;
  error: string | null;
}

const state = ref<ChatState>({
  sessionId: null,
  articleId: null,
  workflow: null,
  messages: [],
  status: 'idle',
  streamContent: '',
  error: null,
});

let abortController: AbortController | null = null;

// Approximate token count: ~4 chars = 1 token for Chinese, simpler for English
function estimateTokens(text: string): number {
  // Count CJK chars as ~1.5 tokens each, others as ~0.25 tokens each
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      cjk++;
    } else {
      other++;
    }
  }
  return Math.ceil(cjk * 1.5 + other * 0.25);
}

function truncateToTokens(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text;

  // Binary search for cutoff
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (estimateTokens(text.slice(0, mid)) <= maxTokens) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return text.slice(0, lo) + '\n\n...(文章内容已截断)';
}

export function useChat() {
  const messages = computed(() => state.value.messages);
  const status = computed(() => state.value.status);
  const streamContent = computed(() => state.value.streamContent);
  const error = computed(() => state.value.error);
  const sessionId = computed(() => state.value.sessionId);
  const currentWorkflow = computed(() => state.value.workflow);

  async function loadSession(articleId: string): Promise<void> {
    const result = await chatRepo.getFullSession(articleId);
    if (result) {
      state.value.sessionId = result.session.id;
      state.value.articleId = articleId;
      state.value.workflow = result.session.workflow as WorkflowType;
      state.value.messages = result.messages;
      state.value.status = 'idle';
      state.value.streamContent = '';
      state.value.error = null;
    } else {
      state.value.sessionId = null;
      state.value.articleId = articleId;
      state.value.workflow = null;
      state.value.messages = [];
      state.value.status = 'idle';
      state.value.streamContent = '';
      state.value.error = null;
    }
  }

  async function startAnalysis(
    articleId: string,
    articleTitle: string,
    articleMarkdown: string,
    workflow: WorkflowType,
  ): Promise<void> {
    // Get model config
    const fullConfig = await modelConfigRepo.getFullConfig('superbrain-derive');
    if (!fullConfig) {
      state.value.error = '请先在设置中配置 LLM API Key';
      state.value.status = 'error';
      return;
    }

    // Delete old session for this article if exists
    const existingSession = await chatRepo.getSessionByArticleId(articleId);
    if (existingSession) {
      await chatRepo.deleteSession(existingSession.id);
    }

    // Create new session
    const wf = getWorkflow(workflow);
    const session = await chatRepo.createSession({
      articleId,
      providerId: fullConfig.providerId,
      providerName: fullConfig.providerName,
      modelName: fullConfig.modelName,
      workflow,
      systemPrompt: wf.systemPromptTemplate,
      title: articleTitle,
    });

    // Build prompts
    const { system, user } = buildWorkflowPrompts(workflow, {
      title: articleTitle,
      markdown: truncateToTokens(articleMarkdown, 8000),
    });

    // Save system message
    await chatRepo.saveMessage({
      sessionId: session.id,
      role: 'system',
      content: system,
      createdAt: new Date().toISOString(),
    });

    // Save user message
    const userMsg: ChatMessage = {
      sessionId: session.id,
      role: 'user',
      content: user,
      createdAt: new Date().toISOString(),
    };
    await chatRepo.saveMessage(userMsg);

    state.value.sessionId = session.id;
    state.value.articleId = articleId;
    state.value.workflow = workflow;
    state.value.messages = [userMsg];
    state.value.status = 'generating';
    state.value.streamContent = '';
    state.value.error = null;

    await streamResponse(fullConfig.baseUrl, fullConfig.apiKey, fullConfig.modelName, session.id, [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
  }

  async function sendMessage(articleId: string, content: string): Promise<void> {
    if (!state.value.sessionId) {
      // No session yet — need to start analysis first
      state.value.error = '请先选择工作流并运行 AI 分析';
      state.value.status = 'error';
      return;
    }

    const fullConfig = await modelConfigRepo.getFullConfig('superbrain-derive');
    if (!fullConfig) {
      state.value.error = '请先在设置中配置 LLM API Key';
      state.value.status = 'error';
      return;
    }

    // Save user message
    const userMsg: ChatMessage = {
      sessionId: state.value.sessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    await chatRepo.saveMessage(userMsg);
    state.value.messages.push(userMsg);
    state.value.status = 'generating';
    state.value.streamContent = '';
    state.value.error = null;

    // Build full message history for API
    const apiMessages = buildApiMessages();

    await chatRepo.touchSession(state.value.sessionId);
    await streamResponse(fullConfig.baseUrl, fullConfig.apiKey, fullConfig.modelName, state.value.sessionId, apiMessages);
  }

  function buildApiMessages(): Array<{ role: string; content: string }> {
    // Find the system prompt from the session
    const msgs: Array<{ role: string; content: string }> = [];

    // First message should be system (from original analysis)
    const systemMsg = state.value.messages.find((m) => m.role === 'system');
    if (systemMsg) {
      msgs.push({ role: 'system', content: systemMsg.content });
    }

    // Then user + assistant pairs
    for (const msg of state.value.messages) {
      if (msg.role === 'user') {
        msgs.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        msgs.push({ role: 'assistant', content: msg.content });
      }
    }

    return msgs;
  }

  async function streamResponse(
    baseUrl: string,
    apiKey: string,
    model: string,
    sessionId: string,
    apiMessages: Array<{ role: string; content: string }>,
  ): Promise<void> {
    abortController = new AbortController();
    let fullContent = '';

    try {
      const stream = streamChatCompletion({
        baseUrl,
        apiKey,
        model,
        messages: apiMessages,
        signal: abortController.signal,
      });

      for await (const delta of stream) {
        fullContent += delta;
        state.value.streamContent = fullContent;
      }

      // Save assistant message
      const assistantMsg: ChatMessage = {
        sessionId,
        role: 'assistant',
        content: fullContent,
        createdAt: new Date().toISOString(),
      };
      await chatRepo.saveMessage(assistantMsg);
      state.value.messages.push(assistantMsg);
      state.value.status = 'done';
    } catch (err: any) {
      const streamErr = err as StreamError;
      if (streamErr.type === 'aborted') {
        // User stopped — save partial content
        if (fullContent) {
          const assistantMsg: ChatMessage = {
            sessionId,
            role: 'assistant',
            content: fullContent + '\n\n*(生成已中断)*',
            createdAt: new Date().toISOString(),
          };
          await chatRepo.saveMessage(assistantMsg);
          state.value.messages.push(assistantMsg);
        }
        state.value.status = 'done';
      } else {
        state.value.status = 'error';
        state.value.error = streamErr.message || '请求失败，请重试';
        // Keep partial content visible
        if (fullContent) {
          state.value.streamContent = fullContent;
        }
      }
    } finally {
      abortController = null;
      state.value.streamContent = '';
    }
  }

  function stopGeneration(): void {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  async function clearContext(): Promise<void> {
    if (state.value.sessionId) {
      await chatRepo.deleteSession(state.value.sessionId);
    }
    state.value.sessionId = null;
    state.value.messages = [];
    state.value.status = 'idle';
    state.value.streamContent = '';
    state.value.error = null;
    state.value.workflow = null;
  }

  function copySummary(): void {
    const lastAssistant = [...state.value.messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (lastAssistant) {
      navigator.clipboard.writeText(lastAssistant.content).catch(() => {
        // Fallback: create textarea
        const ta = document.createElement('textarea');
        ta.value = lastAssistant.content;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      });
    }
  }

  function retryLast(): void {
    state.value.error = null;
    if (state.value.articleId && state.value.workflow) {
      // Remove last assistant message if it was partial
      const lastMsg = state.value.messages[state.value.messages.length - 1];
      if (lastMsg?.role === 'assistant') {
        state.value.messages.pop();
      }
      // Re-send the last user message
      const lastUser = [...state.value.messages].reverse().find((m) => m.role === 'user');
      if (lastUser) {
        sendMessage(state.value.articleId!, lastUser.content);
      }
    }
  }

  return {
    messages,
    status,
    streamContent,
    error,
    sessionId,
    currentWorkflow,
    loadSession,
    startAnalysis,
    sendMessage,
    stopGeneration,
    clearContext,
    copySummary,
    retryLast,
  };
}
