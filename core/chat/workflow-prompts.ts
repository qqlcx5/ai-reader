// ============================================================
// Workflow Prompt Templates — 4 AI analysis modes
// Variables: {title}, {markdown} injected at runtime
// ============================================================

export type WorkflowType = 'tldr' | 'knowledge-extractor' | 'action-items' | 'generate-tags';

export interface WorkflowDefinition {
  type: WorkflowType;
  label: string;
  description: string;
  systemPromptTemplate: string;
  userPromptTemplate: string;
}

/**
 * Inject variables into a template string.
 * Replaces {title} and {markdown} placeholders.
 */
export function injectVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

/**
 * All 4 workflow definitions with label, description, and prompt templates.
 */
export const WORKFLOWS: Record<WorkflowType, WorkflowDefinition> = {
  // ---- 1: TL;DR 摘要 ----
  tldr: {
    type: 'tldr',
    label: 'TL;DR 摘要',
    description: '生成结构化摘要：核心观点 + 关键结论',
    systemPromptTemplate: [
      '你是一个专业的文章摘要助手。你的任务是对用户提供的文章生成精炼的结构化摘要。',
      '要求：',
      '- 用中文输出',
      '- 摘要控制在 200-400 字',
      '- 结构：**核心观点**（1-2 句话概括文章主旨） + **关键结论**（3-5 条要点，每条用 bullet）',
      '- 如果文章包含数据或统计，请保留关键数字',
      '- 不要添加原文中没有的信息',
      '- 语气客观中立',
    ].join('\n'),
    userPromptTemplate: [
      '请为以下文章生成 TL;DR 摘要：',
      '',
      '# {title}',
      '',
      '{markdown}',
    ].join('\n'),
  },

  // ---- 2: 核心知识榨汁机 ----
  'knowledge-extractor': {
    type: 'knowledge-extractor',
    label: '核心知识榨汁机',
    description: '提取 3-5 个核心知识点 + CODE 模型分析',
    systemPromptTemplate: [
      '你是一个深度知识提取助手，擅长从长文中提取和压缩核心知识。',
      '你的输出采用 CODE 模型框架：',
      '- **C**apture（捕获）：识别文章中的关键概念和术语',
      '- **O**rganize（组织）：将知识按逻辑结构组织',
      '- **D**istill（提炼）：用简洁语言表达核心洞察',
      '- **E**xpress（表达）：将知识点转化为可回忆、可应用的形式',
      '',
      '输出格式：',
      '1. 先给出 3-5 个核心知识点，每个知识点包含：',
      '   - **概念名称**：一句话定义',
      '   - **关键细节**：2-3 句话展开',
      '2. 然后是「CODE 模型速查卡」：',
      '   - Capture 捕获了什么',
      '   - Organize 如何组织的',
      '   - Distill 精炼后的洞察',
      '   - Express 应用建议',
      '',
      '用中文输出。语气专业、精炼。',
    ].join('\n'),
    userPromptTemplate: [
      '请从以下文章中提取核心知识：',
      '',
      '# {title}',
      '',
      '{markdown}',
    ].join('\n'),
  },

  // ---- 3: Action Items ----
  'action-items': {
    type: 'action-items',
    label: 'Action Items',
    description: '生成可执行的行动建议列表',
    systemPromptTemplate: [
      '你是一个行动建议生成助手。你的任务是从文章中提炼出可执行的行动建议。',
      '',
      '输出格式：',
      '- 每个 Action Item 包含：',
      '  - **行动标题**：具体、可执行的操作描述（以动词开头）',
      '  - **优先级**：🔴 高 / 🟡 中 / 🟢 低',
      '  - **背景说明**：为什么建议这个行动，引用文章中的依据',
      '  - **预期效果**：执行后的可能收益',
      '- 生成 5-10 条行动建议',
      '- 按优先级排序',
      '',
      '要求：',
      '- 行动建议必须具体、可量化、可执行',
      '- 不要重复或泛泛而谈',
      '- 用中文输出',
    ].join('\n'),
    userPromptTemplate: [
      '请从以下文章中提炼出可执行的行动建议：',
      '',
      '# {title}',
      '',
      '{markdown}',
    ].join('\n'),
  },

  // ---- 4: Generate Tags ----
  'generate-tags': {
    type: 'generate-tags',
    label: '生成 Tags',
    description: '根据文章内容生成 3-7 个分类标签',
    systemPromptTemplate: [
      '你是一个内容分类标签生成助手。根据文章内容生成准确的分类标签。',
      '',
      '要求：',
      '- 生成 3-7 个标签',
      '- 每个标签是 2-5 个字的简洁短语',
      '- 标签应覆盖：领域/主题、技术/方法论、应用场景',
      '- 标签按重要性排序',
      '- 以 JSON 数组格式输出纯标签列表，如 ["标签A", "标签B"]',
      '- 不要输出 JSON 以外的内容',
      '- 用中文',
    ].join('\n'),
    userPromptTemplate: [
      '请为以下文章生成分类标签：',
      '',
      '# {title}',
      '',
      '{markdown}',
    ].join('\n'),
  },
};

/**
 * Get a workflow definition by type.
 */
export function getWorkflow(type: WorkflowType): WorkflowDefinition {
  return WORKFLOWS[type];
}

/**
 * Build System + User prompts for a given workflow and article.
 */
export function buildWorkflowPrompts(
  type: WorkflowType,
  vars: { title: string; markdown: string },
): { system: string; user: string } {
  const wf = getWorkflow(type);
  return {
    system: wf.systemPromptTemplate,
    user: injectVariables(wf.userPromptTemplate, vars),
  };
}

/**
 * List all available workflows (for UI display).
 */
export function listWorkflows(): Array<{ type: WorkflowType; label: string; description: string }> {
  return Object.values(WORKFLOWS).map(({ type, label, description }) => ({ type, label, description }));
}
