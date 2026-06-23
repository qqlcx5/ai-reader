<script lang="ts" setup>
/**
 * M5 — RelayChainPanel
 *
 * Visual builder for a serial relay chain (up to 4 nodes).
 * Each node: model selector + prompt template + output variable name.
 * Nodes are connected with arrow indicators.
 * Bottom: 【启动接力】button.
 */
import { ref, reactive, computed } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';
import { useWorkflowStore } from '@/stores/workflow.store';
import { useContextStore } from '@/stores/context.store';
import { runRelayChain } from '@/lib/workflow';
import type { WorkflowNodeSpec } from '@/lib/workflow';

interface RelayNode {
  id: string;
  name: string;
  providerId: string;
  systemPrompt: string;
  upstreamNodeIds: string[];
}

const MAX_NODES = 4;

const settings = useSettingsStore();
const wf       = useWorkflowStore();
const ctx      = useContextStore();

const question  = ref('');
const errorMsg  = ref('');
const isRunning = computed(() => wf.isRunning);

const nodes = reactive<RelayNode[]>([
  {
    id: 'node-0',
    name: 'Step 1',
    providerId: '',
    systemPrompt: '',
    upstreamNodeIds: [],
  },
  {
    id: 'node-1',
    name: 'Step 2',
    providerId: '',
    systemPrompt: '',
    upstreamNodeIds: ['node-0'],
  },
]);

const providers = computed(() =>
  settings.settings.providers
    .filter((p) => p.enabled !== false)
    .map((p) => ({ id: p.id, label: p.name })),
);

function addNode() {
  if (nodes.length >= MAX_NODES) return;
  const prev = nodes[nodes.length - 1];
  nodes.push({
    id: `node-${nodes.length}`,
    name: `Step ${nodes.length + 1}`,
    providerId: '',
    systemPrompt: '',
    upstreamNodeIds: prev ? [prev.id] : [],
  });
}

function removeNode(idx: number) {
  if (nodes.length <= 1) return;
  nodes.splice(idx, 1);
  // Re-wire upstreams sequentially
  nodes.forEach((n, i) => {
    n.upstreamNodeIds = i === 0 ? [] : [nodes[i - 1].id];
  });
}

async function launch() {
  errorMsg.value = '';
  if (!question.value.trim()) {
    errorMsg.value = '请先输入初始输入内容';
    return;
  }
  const emptyPrompt = nodes.find((n) => !n.systemPrompt.trim());
  if (emptyPrompt) {
    errorMsg.value = `节点 "${emptyPrompt.name}" 的 System Prompt 不能为空`;
    return;
  }

  const spec: WorkflowNodeSpec[] = nodes.map((n, i) => ({
    id: n.id,
    order: i,
    name: n.name,
    providerId: n.providerId || (providers.value[0]?.id ?? ''),
    systemPrompt: n.systemPrompt,
    upstreamNodeIds: n.upstreamNodeIds,
  }));

  const now = Date.now();
  const sessionStub = {
    id: crypto.randomUUID(),
    type: 'relay' as const,
    title: '接力链',
    createdAt: now,
    updatedAt: now,
    contextId: null,
    nodes: spec.map((n) => ({ ...n, status: 'pending' as const, output: '' })),
    status: 'running' as const,
  };
  wf.startSession(sessionStub);

  const resolveProvider = (id: string) => {
    const p = settings.settings.providers.find((p) => p.id === id);
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      type: p.type as import('@/modules/provider').ProviderConfig['type'],
      model: p.defaultModel ?? '',
      apiKey: p.apiKey ?? '',
      baseUrl: p.baseUrl,
      enabled: p.enabled ?? true,
    };
  };

  const controller = new AbortController();
  try {
    await runRelayChain({
      templateName: '接力链',
      spec,
      userQuestion: question.value,
      contextContent: ctx.currentContext?.fullText ?? null,
      resolveProvider,
      callbacks: {
        onNodeDelta:   (id, d) => wf.appendNodeDelta(id, d),
        onNodeStatus:  (id, s) => wf.updateNodeStatus(id, s),
        onSessionStatus: (s)  => wf.setSessionStatus(s),
      },
      signal: controller.signal,
    });
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err);
  }
}
</script>

<template>
  <div class="relay-panel">
    <!-- Node list with arrows -->
    <div class="relay-panel__nodes">
      <template v-for="(node, idx) in nodes" :key="node.id">
        <!-- Node card -->
        <div class="relay-panel__node">
          <div class="relay-panel__node-head">
            <input
              v-model="node.name"
              class="relay-panel__node-name"
              placeholder="节点名称"
            />
            <button
              v-if="nodes.length > 1"
              type="button"
              class="relay-panel__node-remove"
              aria-label="删除节点"
              @click="removeNode(idx)"
            >
              ×
            </button>
          </div>

          <!-- Provider -->
          <label class="relay-panel__field">
            <span class="relay-panel__label">模型</span>
            <select v-model="node.providerId" class="relay-panel__select">
              <option value="">自动（首个可用）</option>
              <option v-for="p in providers" :key="p.id" :value="p.id">
                {{ p.label }}
              </option>
            </select>
          </label>

          <!-- System prompt -->
          <label class="relay-panel__field">
            <span class="relay-panel__label">System Prompt</span>
            <textarea
              v-model="node.systemPrompt"
              class="relay-panel__textarea"
              rows="3"
              placeholder="本节点的任务描述（上游输出会自动注入）"
            />
          </label>
        </div>

        <!-- Arrow connector -->
        <div v-if="idx < nodes.length - 1" class="relay-panel__arrow" aria-hidden="true">
          <span class="relay-panel__arrow-line" />
          <span class="relay-panel__arrow-head">▼</span>
        </div>
      </template>
    </div>

    <!-- Add node button -->
    <button
      v-if="nodes.length < MAX_NODES"
      type="button"
      class="relay-panel__add"
      @click="addNode"
    >
      + 添加节点（{{ nodes.length }}/{{ MAX_NODES }}）
    </button>

    <!-- Question input -->
    <label class="relay-panel__field">
      <span class="relay-panel__label">初始输入</span>
      <textarea
        v-model="question"
        class="relay-panel__textarea relay-panel__question"
        rows="3"
        placeholder="第一个节点将收到此内容作为输入…"
      />
    </label>

    <p v-if="errorMsg" class="relay-panel__error">{{ errorMsg }}</p>

    <!-- Launch button -->
    <button
      type="button"
      class="relay-panel__launch"
      :disabled="isRunning"
      @click="launch"
    >
      {{ isRunning ? '运行中…' : '启动接力' }}
    </button>
  </div>
</template>

<style scoped>
.relay-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.relay-panel__nodes {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.relay-panel__node {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
}

.relay-panel__node-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.relay-panel__node-name {
  flex: 1;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
}

.relay-panel__node-name:focus {
  outline: none;
  border-color: var(--primary);
}

.relay-panel__node-remove {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.relay-panel__node-remove:hover {
  background: var(--red-soft);
  color: var(--red);
  border-color: var(--red);
}

/* Arrow connector between nodes */
.relay-panel__arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  color: var(--muted-light);
}

.relay-panel__arrow-line {
  display: block;
  width: 1px;
  height: 10px;
  background: var(--border);
}

.relay-panel__arrow-head {
  font-size: 10px;
  line-height: 1;
}

.relay-panel__field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.relay-panel__label {
  font-size: var(--fs-11);
  color: var(--muted);
  font-weight: 600;
}

.relay-panel__select,
.relay-panel__textarea {
  font-size: var(--fs-xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  padding: 4px 8px;
  font-family: inherit;
  resize: vertical;
}

.relay-panel__select:focus,
.relay-panel__textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.relay-panel__question {
  min-height: 72px;
}

.relay-panel__add {
  font-size: var(--fs-xs);
  background: var(--panel);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  color: var(--muted);
  padding: 8px;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.12s, color 0.12s;
}

.relay-panel__add:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.relay-panel__error {
  font-size: var(--fs-11);
  color: var(--red);
  background: var(--red-soft);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin: 0;
}

.relay-panel__launch {
  width: 100%;
  padding: 9px 16px;
  font-size: var(--fs-xs);
  font-weight: 600;
  background: var(--primary);
  color: #fff;
  border: 1px solid var(--primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.12s, opacity 0.12s;
}

.relay-panel__launch:hover:not(:disabled) {
  background: #4a4fd4;
}

.relay-panel__launch:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
