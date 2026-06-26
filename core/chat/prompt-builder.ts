import type { ChatMessage } from '@/db/schema';
import type { ModelProviderConfig } from '@/db/schema';

const DEFAULT_SYSTEM_PROMPT = '你是一个 AI 阅读助手。请根据以下网页内容回答用户的问题。请用中文回答，除非用户用其他语言提问。';

const MAX_CONTEXT_CHARS = 50000; // ~12k tokens

export interface BuildPromptOptions {
  markdownContent: string;
  question: string;
  model?: ModelProviderConfig;
  globalSystemPrompt?: string;
  history?: ChatMessage[];
  documentTitle?: string;
  documentUrl?: string;
}

export function buildPrompt(options: BuildPromptOptions): ChatMessage[] {
  const {
    markdownContent,
    question,
    model,
    globalSystemPrompt,
    history = [],
    documentTitle,
    documentUrl,
  } = options;

  // 系统提示词优先级：模型专属 > 全局默认 > 内置默认
  let systemPrompt = model?.systemPrompt || globalSystemPrompt || DEFAULT_SYSTEM_PROMPT;

  // 模板变量替换
  systemPrompt = systemPrompt
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
    .replace(/\{\{url\}\}/g, documentUrl || '')
    .replace(/\{\{title\}\}/g, documentTitle || '');

  // 截断文档内容
  const truncatedContent = truncateContent(markdownContent, MAX_CONTEXT_CHARS);

  const messages: ChatMessage[] = [];

  // 系统消息
  messages.push({
    role: 'system',
    content: systemPrompt,
    timestamp: Date.now(),
  });

  // 历史消息
  for (const msg of history) {
    messages.push(msg);
  }

  // 用户消息（包含文档上下文）
  messages.push({
    role: 'user',
    content: `以下是我正在阅读的网页内容：\n\n---\n\n${truncatedContent}\n\n---\n\n我的问题是：${question}`,
    timestamp: Date.now(),
  });

  return messages;
}

export function truncateContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + '\n\n[内容已截断...]';
}
