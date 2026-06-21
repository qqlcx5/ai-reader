/**
 * M5 Workflows — Roundtable Orchestrator
 *
 * Executes a roundtable workflow: all nodes run concurrently with
 * different role prompts against the same user question + context.
 * Outputs are displayed side-by-side for comparison.
 *
 * Based on design-05-workflows.md §4.
 */

import type {
  WorkflowSession,
  WorkflowNode,
  WorkflowContext,
  WorkflowCallbacks,
} from './types';
import { createProvider } from '../providers';

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Execute a roundtable workflow session.
 *
 * All nodes run in parallel. Each node receives the extracted page
 * context (if available) prefixed to its system prompt, plus the
 * user's question as the first message.
 */
export async function runRoundtable(
  session: WorkflowSession,
  userQuestion: string,
  context: WorkflowContext | null,
  callbacks: WorkflowCallbacks,
): Promise<void> {
  const contextPrefix = buildContextPrefix(context);

  const nodeTasks = session.nodes.map((node) =>
    executeNode(node, userQuestion, contextPrefix, callbacks),
  );

  await Promise.allSettled(nodeTasks);

  callbacks.onWorkflowDone('done');
}

// ─── Node Execution ──────────────────────────────────────────────────

async function executeNode(
  node: WorkflowNode,
  userQuestion: string,
  contextPrefix: string,
  callbacks: WorkflowCallbacks,
): Promise<void> {
  node.status = 'running';
  callbacks.onNodeStatus(node.id, 'running');

  try {
    const provider = createProvider(getProviderConfigStub(node.providerId));

    const systemPrompt = contextPrefix
      ? `${contextPrefix}\n\n${node.systemPrompt}`
      : node.systemPrompt;

    let output = '';
    await provider.chatStream(
      {
        providerId: node.providerId,
        systemPrompt,
        messages: [{ role: 'user', content: userQuestion }],
      },
      (event) => {
        switch (event.type) {
          case 'delta':
            output += event.content;
            callbacks.onNodeDelta(node.id, event.content);
            break;
          case 'error':
            node.error = { code: event.code, message: event.message, at: Date.now() };
            node.status = 'error';
            callbacks.onNodeStatus(node.id, 'error');
            break;
        }
      },
    );

    if (node.status !== 'error') {
      node.output = output;
      node.status = 'done';
      callbacks.onNodeStatus(node.id, 'done');
    }
  } catch (err) {
    node.status = 'error';
    node.error = {
      code: 'NODE_ERROR',
      message: err instanceof Error ? err.message : String(err),
      at: Date.now(),
    };
    callbacks.onNodeStatus(node.id, 'error');
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function buildContextPrefix(context: WorkflowContext | null): string {
  if (!context?.pageText) return '';
  return [
    `The following is the content of the web page being discussed:`,
    `Title: ${context.pageTitle}`,
    `URL: ${context.pageUrl}`,
    ``,
    context.pageText.slice(0, 16000), // Truncate to avoid context overflow
    ``,
    `--- End of page content ---`,
  ].join('\n');
}

/** Stub — will be replaced by actual M7 provider config lookup. */
function getProviderConfigStub(providerId: string) {
  // In production, this reads from the settings store / M7
  return {
    id: providerId,
    name: providerId,
    type: 'openai' as const,
    model: 'gpt-4o-mini',
    enabled: true,
  };
}
