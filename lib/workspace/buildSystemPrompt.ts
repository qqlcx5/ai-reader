/**
 * M4 — System prompt construction with extracted context injection
 */
import type { ExtractedContext } from '@/modules/extraction';
import type { ChatMessage, Conversation } from './types';

const SYSTEM_PROMPT_TEMPLATE = `你是一个多模型对比工作区的助手。用户会同时向你与其他模型发送相同问题，请忠实作答。
当前页面上下文已自动注入，请优先基于该上下文回答；如需其他知识，请在回答中明确说明。`;

/**
 * 构造注入页面上下文后的 system prompt。
 * - 无 context：仅返回默认 system prompt
 * - 有 context：在默认 prompt 后追加「## 当前页面」段落
 */
export function buildSystemPrompt(context: ExtractedContext | null): string | undefined {
  if (!context) return SYSTEM_PROMPT_TEMPLATE;
  const parts = [SYSTEM_PROMPT_TEMPLATE, '', '## 当前页面'];
  parts.push(`- 标题：${context.title || '(无标题)'}`);
  if (context.siteName) parts.push(`- 来源：${context.siteName}`);
  parts.push(`- URL：${context.url}`);
  parts.push(`- 字数：${context.wordCount}`);
  parts.push(`- 提取器：${context.extractor}`);
  parts.push('', '### 正文', '', context.content);
  return parts.join('\n');
}

/**
 * 构造发给 LLM 的历史消息序列：
 *   - system: buildSystemPrompt(ctx)
 *   - 历史 user / assistant 交替
 *   - 最后一条是当前 userMessage.content
 */
export function buildHistoryMessages(
  conversation: Conversation,
  userMessage: { role: 'user' | 'assistant'; content?: string },
  history: ReadonlyArray<{ role: 'user' | 'assistant'; content?: string }>,
  context: ExtractedContext | null,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const sys = buildSystemPrompt(context);
  if (sys) messages.push({ role: 'system', content: sys });

  for (const m of history) {
    if (m.role === 'user' || m.role === 'assistant') {
      if (typeof m.content === 'string' && m.content.length > 0) {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }

  if (userMessage.role === 'user' && typeof userMessage.content === 'string') {
    messages.push({ role: 'user', content: userMessage.content });
  } else if (userMessage.role === 'assistant' && typeof userMessage.content === 'string') {
    // 分支追问场景：把上轮助手回答也作为历史的一部分传入
    messages.push({ role: 'assistant', content: userMessage.content });
    messages.push({ role: 'user', content: '(请基于以上回答继续)' });
  }

  // Fallback: 至少有一条 user 消息以保证 messages 合法
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    messages.push({ role: 'user', content: '(空消息)' });
  }

  return messages;
}
