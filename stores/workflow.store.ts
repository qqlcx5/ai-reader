/**
 * M5 — Workflow Pinia store.
 *
 * Holds:
 *  - the list of persisted templates (loaded on demand from M7)
 *  - the in-flight workflow run state (active session + per-node status)
 *  - the user-typed question for the next run
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { WorkflowTemplate, WorkflowSession, WorkflowNodeStatus } from '@/lib/workflow';
import { workflowTemplateRepo } from '@/modules/storage';
import { BUILTIN_TEMPLATE_DEFS } from '@/lib/workflow';

export const useWorkflowStore = defineStore('workflow', () => {
  const templates = ref<WorkflowTemplate[]>([]);
  const activeSession = ref<WorkflowSession | null>(null);
  const runningNodeIds = ref<Set<string>>(new Set());
  const pendingQuestion = ref<string>('');
  const isRunning = computed(() => activeSession.value?.status === 'running');

  async function loadTemplates(): Promise<void> {
    // Ensure built-ins exist (idempotent).
    await workflowTemplateRepo.seedBuiltIn(
      BUILTIN_TEMPLATE_DEFS.map((t) => ({
        name: t.name,
        type: t.type,
        description: t.description,
        nodes: t.nodes,
      })),
    );
    const records = await workflowTemplateRepo.list();
    templates.value = records.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      description: r.description,
      nodes: r.nodes,
      builtIn: r.builtIn,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  function startSession(session: WorkflowSession): void {
    activeSession.value = session;
    runningNodeIds.value = new Set();
  }

  function updateNodeStatus(nodeId: string, status: WorkflowNodeStatus): void {
    if (!activeSession.value) return;
    const node = activeSession.value.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    node.status = status;
    if (status === 'running') {
      const next = new Set(runningNodeIds.value);
      next.add(nodeId);
      runningNodeIds.value = next;
    } else {
      const next = new Set(runningNodeIds.value);
      next.delete(nodeId);
      runningNodeIds.value = next;
    }
  }

  function appendNodeDelta(nodeId: string, delta: string): void {
    if (!activeSession.value) return;
    const node = activeSession.value.nodes.find((n) => n.id === nodeId);
    if (node) node.output += delta;
  }

  function setSessionStatus(status: WorkflowSession['status']): void {
    if (activeSession.value) activeSession.value.status = status;
  }

  function clearSession(): void {
    activeSession.value = null;
    runningNodeIds.value = new Set();
  }

  return {
    templates,
    activeSession,
    runningNodeIds,
    pendingQuestion,
    isRunning,
    loadTemplates,
    startSession,
    updateNodeStatus,
    appendNodeDelta,
    setSessionStatus,
    clearSession,
  };
});
