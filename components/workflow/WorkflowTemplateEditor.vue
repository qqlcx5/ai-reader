<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useWorkflowStore } from '@/stores/workflow.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useContextStore } from '@/stores/context.store';
import { conversationRepo, messageRepo } from '@/modules/storage';
import {
  runRoundtable,
  runRelayChain,
  validateTemplate,
  TemplateValidationError,
  type WorkflowTemplate,
  type WorkflowNodeSpec,
  type WorkflowType,
} from '@/lib/workflow';
import { workflowTemplateRepo } from '@/modules/storage';
import WorkflowTemplateList from './WorkflowTemplateList.vue';
import NodeEditor from './NodeEditor.vue';

const wf = useWorkflowStore();
const settings = useSettingsStore();
const ctx = useContextStore();

const emit = defineEmits<{
  (e: 'run-started'): void;
  (e: 'run-finished'): void;
  (e: 'error', message: string): void;
}>();

const mode = ref<'list' | 'editor'>('list');
const draft = ref<{
  name: string;
  type: WorkflowType;
  description: string;
  nodes: WorkflowNodeSpec[];
} | null>(null);
const errorMessage = ref('');
const editingId = ref<string | null>(null);
const editingBuiltIn = ref(false);
const question = ref('');

const providers = computed(() =>
  settings.settings.providers.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    apiKey: p.apiKey,
    baseUrl: p.baseUrl,
    model: p.defaultModel ?? '',
    enabled: p.enabled ?? true,
  })),
);

const validation = computed(() => {
  if (!draft.value) return { valid: true, errors: [] as string[] };
  return validateTemplate(draft.value.name, draft.value.type, draft.value.nodes);
});

function newRoundtable(): void {
  draft.value = {
    name: '新圆桌',
    type: 'roundtable',
    description: '',
    nodes: [
      { id: crypto.randomUUID().slice(0, 8), order: 0, name: '红方', providerId: '', systemPrompt: '…', upstreamNodeIds: [] },
      { id: crypto.randomUUID().slice(0, 8), order: 1, name: '蓝方', providerId: '', systemPrompt: '…', upstreamNodeIds: [] },
    ],
  };
  mode.value = 'editor';
  editingId.value = null;
  editingBuiltIn.value = false;
}

function newRelay(): void {
  draft.value = {
    name: '新接力链',
    type: 'relay',
    description: '',
    nodes: [
      { id: crypto.randomUUID().slice(0, 8), order: 0, name: 'Step 1', providerId: '', systemPrompt: '…', upstreamNodeIds: [] },
      { id: crypto.randomUUID().slice(0, 8), order: 1, name: 'Step 2', providerId: '', systemPrompt: '…', upstreamNodeIds: [] },
    ],
  };
  mode.value = 'editor';
  editingId.value = null;
  editingBuiltIn.value = false;
}

function selectTemplate(tpl: WorkflowTemplate): void {
  draft.value = {
    name: tpl.name,
    type: tpl.type,
    description: tpl.description ?? '',
    nodes: tpl.nodes.map((n) => ({ ...n })),
  };
  mode.value = 'editor';
  editingId.value = tpl.id ?? null;
  editingBuiltIn.value = tpl.builtIn ?? false;
}

function backToList(): void {
  mode.value = 'list';
  draft.value = null;
  errorMessage.value = '';
}

function addNode(): void {
  if (!draft.value) return;
  const id = crypto.randomUUID().slice(0, 8);
  draft.value.nodes.push({
    id,
    order: draft.value.nodes.length,
    name: `Node ${draft.value.nodes.length + 1}`,
    providerId: '',
    systemPrompt: '',
    upstreamNodeIds: [],
  });
}

function updateNode(id: string, patch: Partial<WorkflowNodeSpec>): void {
  if (!draft.value) return;
  const node = draft.value.nodes.find((n) => n.id === id);
  if (!node) return;
  Object.assign(node, patch);
}

function removeNode(id: string): void {
  if (!draft.value) return;
  draft.value.nodes = draft.value.nodes
    .filter((n) => n.id !== id)
    .map((n, i) => ({ ...n, order: i }));
}

async function saveDraft(): Promise<void> {
  if (!draft.value) return;
  errorMessage.value = '';
  if (!validation.value.valid) {
    errorMessage.value = validation.value.errors.join('；');
    return;
  }
  try {
    if (editingId.value) {
      const existing = await workflowTemplateRepo.getById(editingId.value);
      if (existing) {
        await workflowTemplateRepo.upsert({
          ...existing,
          name: draft.value.name,
          description: draft.value.description,
          nodes: draft.value.nodes,
        });
      }
    } else {
      await workflowTemplateRepo.create({
        name: draft.value.name,
        type: draft.value.type,
        description: draft.value.description,
        nodes: draft.value.nodes,
      });
    }
    await wf.loadTemplates();
    backToList();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : '保存失败';
  }
}

async function run(): Promise<void> {
  if (!draft.value) return;
  if (!question.value.trim()) {
    errorMessage.value = '请先输入要讨论/处理的问题';
    return;
  }
  errorMessage.value = '';
  if (!validation.value.valid) {
    errorMessage.value = validation.value.errors.join('；');
    return;
  }

  // Make sure we have providers
  if (providers.value.length === 0) {
    // Settings are loaded by Pinia persistedstate; nothing to do here.
  }

  const resolveProvider = (id: string) => {
    const p = providers.value.find((p: { id: string }) => p.id === id);
    if (!p) throw new Error(`Provider not found: ${id}`);
    if (!p.enabled) throw new Error(`Provider 已被禁用: ${p.name}`);
    return p;
  };

  const controller = new AbortController();
  const callbacks = {
    onNodeDelta: (id: string, delta: string) => wf.appendNodeDelta(id, delta),
    onNodeStatus: (id: string, status: 'pending' | 'running' | 'done' | 'error' | 'aborted') => wf.updateNodeStatus(id, status),
    onSessionStatus: (status: 'idle' | 'running' | 'paused' | 'done' | 'error') =>
      wf.setSessionStatus(status),
  };
  const contextContent = ctx.currentContext?.fullText ?? null;

  // Pre-create a placeholder session
  const now = Date.now();
  const sessionStub = {
    id: crypto.randomUUID(),
    type: draft.value.type,
    title: draft.value.name,
    createdAt: now,
    updatedAt: now,
    contextId: null,
    nodes: draft.value.nodes.map((n) => ({
      ...n,
      status: 'pending' as const,
      output: '',
      startedAt: null,
      finishedAt: null,
    })),
    status: 'running' as const,
  };
  wf.startSession(sessionStub);
  emit('run-started');

  try {
    if (draft.value.type === 'roundtable') {
      await runRoundtable({
        templateName: draft.value.name,
        spec: draft.value.nodes,
        userQuestion: question.value,
        contextContent,
        resolveProvider,
        callbacks,
        signal: controller.signal,
      });
    } else {
      await runRelayChain({
        templateName: draft.value.name,
        spec: draft.value.nodes,
        userQuestion: question.value,
        contextContent,
        resolveProvider,
        callbacks,
        signal: controller.signal,
      });
    }
    // Persist workflow results as a Conversation
    await saveWorkflowResults();
  } catch (err) {
    if (err instanceof TemplateValidationError) {
      errorMessage.value = err.message;
    } else {
      const e = err as Error;
      errorMessage.value = e.message ?? String(err);
      emit('error', e.message ?? String(err));
    }
  } finally {
    emit('run-finished');
  }

  async function saveWorkflowResults() {
    const session = wf.activeSession;
    if (!session || !draft.value) return;
    const successNodes = session.nodes.filter((n) => n.status === 'done');
    if (successNodes.length === 0) return;

    try {
      const conv = await conversationRepo.create({
        title: `${draft.value.name} · ${session.type === 'roundtable' ? '圆桌' : '接力链'}`,
        mode: session.type,
        activeProviderIds: successNodes.map((n) => n.providerId),
      });

      const userMsgContent = question.value;
      const userMsg = await messageRepo.create({
        conversationId: conv.id,
        role: 'user',
        content: userMsgContent,
        parentId: undefined,
        modelResponses: [],
      });

      const modelResponses = successNodes.map((n) => ({
        providerId: n.providerId,
        modelId: '',
        content: n.output,
        metrics: undefined,
        createdAt: Date.now(),
      }));

      await messageRepo.create({
        conversationId: conv.id,
        role: 'assistant',
        parentId: userMsg.id,
        content: null,
        modelResponses,
      });

      await conversationRepo.update(conv.id, {
        messageCount: 2,
        preview: userMsgContent.slice(0, 100),
      });
    } catch {
      /* best-effort */
    }
  }
}
</script>

<template>
  <div class="wf-editor">
    <template v-if="mode === 'list'">
      <WorkflowTemplateList @select="selectTemplate" />
      <div class="wf-editor__actions">
        <button type="button" class="wf-editor__btn" @click="newRoundtable">+ 新圆桌</button>
        <button type="button" class="wf-editor__btn" @click="newRelay">+ 新接力链</button>
      </div>
    </template>

    <template v-else>
      <div class="wf-editor__head">
        <button class="wf-editor__back" type="button" @click="backToList">← 返回</button>
        <span class="wf-editor__type">{{ draft?.type === 'roundtable' ? '圆桌' : '接力链' }}</span>
      </div>

      <label class="wf-editor__field">
        <span class="wf-editor__label">模板名称</span>
        <input
          v-model="draft!.name"
          :readonly="editingBuiltIn"
          class="wf-editor__input"
          placeholder="为本次工作流起个名字"
        />
      </label>

      <label class="wf-editor__field">
        <span class="wf-editor__label">描述（可选）</span>
        <input
          v-model="draft!.description"
          :readonly="editingBuiltIn"
          class="wf-editor__input"
          placeholder="说明这个模板的用途"
        />
      </label>

      <div class="wf-editor__nodes">
        <div class="wf-editor__nodes-head">
          <span>节点</span>
          <button v-if="!editingBuiltIn" type="button" class="wf-editor__add" @click="addNode">+ 节点</button>
        </div>
        <NodeEditor
          v-for="node in draft!.nodes"
          :key="node.id"
          :node="node"
          :providers="providers"
          :upstream-candidates="draft!.nodes"
          :readonly="editingBuiltIn"
          @update="(patch) => updateNode(node.id, patch)"
          @remove="removeNode(node.id)"
        />
      </div>

      <label v-if="!editingBuiltIn" class="wf-editor__field">
        <span class="wf-editor__label">运行问题</span>
        <textarea
          v-model="question"
          class="wf-editor__textarea"
          rows="3"
          placeholder="要发给工作流的问题（最终用户输入）"
        />
      </label>

      <div v-if="!validation.valid" class="wf-editor__errors">
        <strong>校验失败：</strong>
        <ul>
          <li v-for="(e, i) in validation.errors" :key="i">{{ e }}</li>
        </ul>
      </div>

      <p v-if="errorMessage" class="wf-editor__error">{{ errorMessage }}</p>

      <div v-if="!editingBuiltIn" class="wf-editor__bottom-actions">
        <button type="button" class="wf-editor__btn wf-editor__btn--primary" @click="saveDraft">保存模板</button>
        <button type="button" class="wf-editor__btn wf-editor__btn--accent" @click="run">运行</button>
      </div>
      <div v-else class="wf-editor__bottom-actions">
        <button type="button" class="wf-editor__btn wf-editor__btn--accent" @click="run">运行此模板</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.wf-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.wf-editor__actions,
.wf-editor__bottom-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.wf-editor__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.wf-editor__back {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: var(--fs-xs);
  padding: 2px 6px;
}

.wf-editor__back:hover {
  color: var(--text);
}

.wf-editor__type {
  font-size: var(--fs-11);
  color: var(--primary);
  background: var(--primary-soft);
  padding: 1px 6px;
  border-radius: 999px;
}

.wf-editor__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wf-editor__label {
  font-size: var(--fs-11);
  color: var(--muted);
  font-weight: 600;
}

.wf-editor__input,
.wf-editor__textarea {
  font-size: var(--fs-xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  padding: 6px 8px;
  font-family: inherit;
}

.wf-editor__nodes-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted-light);
}

.wf-editor__add {
  font-size: var(--fs-11);
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  cursor: pointer;
}

.wf-editor__nodes {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.wf-editor__errors {
  background: var(--red-soft);
  border: 1px solid var(--red);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: var(--fs-11);
  color: var(--red);
}

.wf-editor__errors ul {
  margin: 4px 0 0;
  padding-left: 18px;
}

.wf-editor__error {
  background: var(--red-soft);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: var(--fs-11);
  color: var(--red);
  margin: 0;
}

.wf-editor__btn {
  font-size: var(--fs-xs);
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  cursor: pointer;
}

.wf-editor__btn:hover {
  border-color: var(--primary);
}

.wf-editor__btn--primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.wf-editor__btn--primary:hover {
  background: var(--primary-strong);
  border-color: var(--primary-strong);
}

.wf-editor__btn--accent {
  background: var(--green);
  color: white;
  border-color: var(--green);
}
</style>
