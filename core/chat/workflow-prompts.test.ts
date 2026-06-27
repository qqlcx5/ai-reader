// ============================================================
// Tests: Workflow Prompt Templates
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  WORKFLOWS,
  injectVariables,
  getWorkflow,
  buildWorkflowPrompts,
  listWorkflows,
  type WorkflowType,
} from './workflow-prompts';

describe('Workflow Prompts — Variable Injection', () => {
  it('replaces {title} and {markdown} placeholders', () => {
    const template = '# {title}\n\n{markdown}';
    const result = injectVariables(template, {
      title: 'Test Article',
      markdown: 'Some content here.',
    });
    expect(result).toBe('# Test Article\n\nSome content here.');
  });

  it('leaves unknown placeholders intact', () => {
    const template = 'Hello {name}, {title}';
    const result = injectVariables(template, { title: 'World' });
    expect(result).toBe('Hello {name}, World');
  });

  it('handles empty vars', () => {
    const result = injectVariables('{title}', {});
    expect(result).toBe('{title}');
  });

  it('handles multiple occurrences', () => {
    const template = '{title} — {title}';
    const result = injectVariables(template, { title: 'X' });
    expect(result).toBe('X — X');
  });
});

describe('Workflow Prompts — All 4 Templates', () => {
  const testVars = { title: 'Test', markdown: '# Hello' };

  const types: WorkflowType[] = ['tldr', 'knowledge-extractor', 'action-items', 'generate-tags'];

  for (const type of types) {
    it(`${type}: has non-empty system prompt`, () => {
      const wf = getWorkflow(type);
      expect(wf.systemPromptTemplate.length).toBeGreaterThan(0);
    });

    it(`${type}: has non-empty user prompt template`, () => {
      const wf = getWorkflow(type);
      expect(wf.userPromptTemplate.length).toBeGreaterThan(0);
    });

    it(`${type}: user prompt template contains variable placeholders`, () => {
      const wf = getWorkflow(type);
      expect(wf.userPromptTemplate).toContain('{title}');
      expect(wf.userPromptTemplate).toContain('{markdown}');
    });

    it(`${type}: label and description are defined`, () => {
      const wf = getWorkflow(type);
      expect(wf.label.length).toBeGreaterThan(0);
      expect(wf.description.length).toBeGreaterThan(0);
    });
  }
});

describe('Workflow Prompts — buildWorkflowPrompts', () => {
  it('builds system + user prompts for tldr', () => {
    const { system, user } = buildWorkflowPrompts('tldr', {
      title: 'My Article',
      markdown: 'Content here',
    });
    expect(system).toContain('摘要');
    expect(user).toContain('My Article');
    expect(user).toContain('Content here');
  });

  it('builds prompts for knowledge-extractor', () => {
    const { system, user } = buildWorkflowPrompts('knowledge-extractor', {
      title: 'X',
      markdown: 'Y',
    });
    expect(system).toContain('CODE');
    expect(user).toContain('X');
  });

  it('builds prompts for action-items', () => {
    const { system, user } = buildWorkflowPrompts('action-items', {
      title: 'X',
      markdown: 'Y',
    });
    expect(system).toContain('行动');
    expect(user).toContain('X');
  });

  it('builds prompts for generate-tags', () => {
    const { system, user } = buildWorkflowPrompts('generate-tags', {
      title: 'X',
      markdown: 'Y',
    });
    expect(system).toContain('标签');
    expect(system).toContain('JSON');
    expect(user).toContain('X');
  });
});

describe('Workflow Prompts — listWorkflows', () => {
  it('returns all 4 workflows', () => {
    const wfs = listWorkflows();
    expect(wfs).toHaveLength(4);
    const types = wfs.map((w) => w.type);
    expect(types).toContain('tldr');
    expect(types).toContain('knowledge-extractor');
    expect(types).toContain('action-items');
    expect(types).toContain('generate-tags');
  });

  it('each has label and description', () => {
    const wfs = listWorkflows();
    for (const wf of wfs) {
      expect(wf.label).toBeTruthy();
      expect(wf.description).toBeTruthy();
    }
  });
});

describe('Workflow Prompts — JSON format (generate-tags)', () => {
  it('system prompt instructs JSON array output', () => {
    const wf = getWorkflow('generate-tags');
    expect(wf.systemPromptTemplate).toContain('JSON');
    expect(wf.systemPromptTemplate).toContain('[');
  });
});
