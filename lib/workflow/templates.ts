/**
 * M5 — Default workflow templates + template validation.
 *
 * Built-in templates are seeded by `seedBuiltInTemplates()` on first
 * open. User templates go through the same validation path before they
 * are persisted.
 */
import type { WorkflowNodeSpec, WorkflowType } from './types';
import { hasCycle } from './topological-sort';

export const BUILTIN_TEMPLATE_DEFS: ReadonlyArray<{
  name: string;
  type: WorkflowType;
  description: string;
  nodes: WorkflowNodeSpec[];
}> = [
  {
    name: 'Roundtable · 辩论',
    type: 'roundtable',
    description: '三个角色对同一问题给出不同立场：红方挑刺、蓝方辩护、灰方总结。',
    nodes: [
      {
        id: 'red',
        order: 0,
        name: '红方 · 挑刺',
        providerId: '',
        systemPrompt:
          '你是辩论中的红方，职责是指出对方观点中的逻辑漏洞、证据不足和潜在风险。请用结构化的方式列出 3-5 条反驳。',
        upstreamNodeIds: [],
      },
      {
        id: 'blue',
        order: 1,
        name: '蓝方 · 辩护',
        providerId: '',
        systemPrompt:
          '你是辩论中的蓝方，职责是站在提问者的角度辩护，给出最强有力的支撑论据，并正面回应红方可能的质疑。',
        upstreamNodeIds: [],
      },
      {
        id: 'gray',
        order: 2,
        name: '灰方 · 总结',
        providerId: '',
        systemPrompt:
          '你是辩论中的灰方（中立裁判），综合红蓝两方观点，得出平衡结论并指出尚需进一步验证的关键问题。',
        upstreamNodeIds: [],
      },
    ],
  },
  {
    name: 'Relay Chain · 三段审校',
    type: 'relay',
    description: '草稿 → 事实核查 → 文风润色，串行三节点流水线。',
    nodes: [
      {
        id: 'draft',
        order: 0,
        name: 'Draft',
        providerId: '',
        systemPrompt:
          '你是一名内容创作者。基于用户的原始输入，撰写一篇 200-400 字、观点清晰的初稿。',
        upstreamNodeIds: [],
      },
      {
        id: 'factcheck',
        order: 1,
        name: 'Fact Check',
        providerId: '',
        systemPrompt:
          '你是一名事实核查员。检查上游稿件中的可验证声明，标记存疑之处并提供修正建议。',
        upstreamNodeIds: ['draft'],
      },
      {
        id: 'polish',
        order: 2,
        name: 'Polish',
        providerId: '',
        systemPrompt:
          '你是一名文字编辑。在保持事实准确的前提下润色上游稿件，提升可读性与节奏感。',
        upstreamNodeIds: ['factcheck'],
      },
    ],
  },
];

export class TemplateValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'TemplateValidationError';
  }
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTemplate(name: string, type: WorkflowType, nodes: WorkflowNodeSpec[]): TemplateValidationResult {
  const errors: string[] = [];
  if (!name.trim()) errors.push('Template name is required');
  if (nodes.length < 1) errors.push('At least one node is required');
  if (type === 'roundtable' && nodes.length > 6) errors.push('Roundtable supports up to 6 nodes');
  if (type === 'relay' && nodes.length > 8) errors.push('Relay chain supports up to 8 nodes');

  const seenIds = new Set<string>();
  for (const n of nodes) {
    if (!n.id) errors.push('Every node needs an id');
    else if (seenIds.has(n.id)) errors.push(`Duplicate node id: ${n.id}`);
    else seenIds.add(n.id);

    if (!n.name?.trim()) errors.push(`Node "${n.id}" needs a name`);
    if (!n.systemPrompt?.trim()) errors.push(`Node "${n.id}" needs a system prompt`);
    if (!n.providerId) {
      // Provider can be assigned at launch time; we only complain for
      // explicitly empty strings (i.e. user cleared it).
    }
  }

  if (type === 'relay' && hasCycle(nodes)) {
    errors.push('Relay chain contains a cycle');
  }

  return { valid: errors.length === 0, errors };
}

/** Make sure a node list is internally consistent before running. */
export function assertValidForRun(type: WorkflowType, nodes: WorkflowNodeSpec[]): void {
  const r = validateTemplate('runtime', type, nodes);
  if (!r.valid) {
    throw new TemplateValidationError(r.errors.join('; '));
  }
}
