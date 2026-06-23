<script lang="ts" setup>
/**
 * M5 — RoundtablePanel
 *
 * Displays 3 preset roles (红方挑刺 / 蓝方辩护 / 产品落地) in a card grid.
 * Each card has: role name, color indicator, model dropdown, system prompt input.
 * Bottom: 【启动圆桌】primary purple button + 【重置】outline button.
 */
import { ref, reactive, computed } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';
import { useWorkflowStore } from '@/stores/workflow.store';
import { useContextStore } from '@/stores/context.store';
import { runRoundtable } from '@/lib/workflow';
import type { WorkflowNodeSpec } from '@/lib/workflow';

interface RoleConfig {
  id: string;
  name: string;
  color: string;
  colorBg: string;
  systemPrompt: string;
  providerId: string;
}

const DEFAULT_ROLES: RoleConfig[] = [
  {
    id: 'red',
    name: '🟥 红方 · 挑刺',
    color: 'var(--red)',
    colorBg: 'var(--red-soft)',
    systemPrompt: '请以批判性思维挑出文章的逻辑漏洞、证据不足和潜在风险，列出 3-5 条具体问题。',
    providerId: '',
  },
  {
    id: 'blue',
    name: '🟩 蓝方 · 辩护',
    color: 'var(--green)',
    colorBg: 'var(--green-soft)',
    systemPrompt: '请以支持者角度补充文章的合理之处，给出最强有力的支撑论据，并回应潜在质疑。',
    providerId: '',
  },
  {
    id: 'product',
    name: '🟧 产品 · 落地',
    color: 'var(--orange)',
    colorBg: 'var(--orange-soft)',
    systemPrompt: '请从产品经理角度分析文章的落地价值，指出可行的产品方向或用户场景。',
    providerId: '',
  },
];

const settings = useSettingsStore();
const wf       = useWorkflowStore();
const ctx      = useContextStore();

const roles = reactive<RoleConfig[]>(DEFAULT_ROLES.map((r) => ({ ...r })));
const question    = ref('');
const errorMsg    = ref('');
const isRunning   = computed(() => wf.isRunning);

const providers = computed(() =>
  settings.settings.providers
    .filter((p) => p.enabled !== false)
    .map((p) => ({ id: p.id, label: `${p.name}` })),
);

function reset() {
  DEFAULT_ROLES.forEach((def, i) => {
    roles[i].systemPrompt = def.systemPrompt;
    roles[i].providerId   = def.providerId;
  });
  question.value = '';
  errorMsg.value = '';
  wf.clearSession();
}

async function launch() {
  errorMsg.value = '';
  if (!question.value.trim()) {
    errorMsg.value = '请先输入要讨论的问题或主题';
    return;
  }

  const spec: WorkflowNodeSpec[] = roles.map((r, i) => ({
    id: r.id,
    order: i,
    name: r.name,
    providerId: r.providerId || (providers.value[0]?.id ?? ''),
    systemPrompt: r.systemPrompt,
    upstreamNodeIds: [],
  }));

  const now = Date.now();
  const sessionStub = {
    id: crypto.randomUUID(),
    type: 'roundtable' as const,
    title: '圆桌讨论',
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
    await runRoundtable({
      templateName: '圆桌讨论',
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
  <div class="rt-panel">
    <!-- Role cards grid -->
    <div class="rt-panel__grid">
      <div
        v-for="role in roles"
        :key="role.id"
        class="rt-panel__card"
        :style="{ '--role-color': role.color, '--role-bg': role.colorBg }"
      >
        <!-- Card header -->
        <div class="rt-panel__card-head">
          <span class="rt-panel__role-dot" />
          <span class="rt-panel__role-name">{{ role.name }}</span>
        </div>

        <!-- Provider selector -->
        <label class="rt-panel__field">
          <span class="rt-panel__label">模型</span>
          <select v-model="role.providerId" class="rt-panel__select">
            <option value="">自动（首个可用）</option>
            <option v-for="p in providers" :key="p.id" :value="p.id">
              {{ p.label }}
            </option>
          </select>
        </label>

        <!-- System prompt -->
        <label class="rt-panel__field">
          <span class="rt-panel__label">System Prompt</span>
          <textarea
            v-model="role.systemPrompt"
            class="rt-panel__textarea"
            rows="3"
            placeholder="角色职责描述…"
          />
        </label>
      </div>
    </div>

    <!-- Question input -->
    <label class="rt-panel__field">
      <span class="rt-panel__label">讨论问题 / 文章内容</span>
      <textarea
        v-model="question"
        class="rt-panel__textarea rt-panel__question"
        rows="3"
        placeholder="请输入要多角色分析的问题或粘贴文章内容…"
      />
    </label>

    <p v-if="errorMsg" class="rt-panel__error">{{ errorMsg }}</p>

    <!-- Action buttons -->
    <div class="rt-panel__actions">
      <button
        type="button"
        class="rt-panel__btn rt-panel__btn--primary"
        :disabled="isRunning"
        @click="launch"
      >
        {{ isRunning ? '运行中…' : '启动圆桌' }}
      </button>
      <button
        type="button"
        class="rt-panel__btn rt-panel__btn--outline"
        :disabled="isRunning"
        @click="reset"
      >
        重置
      </button>
    </div>
  </div>
</template>

<style scoped>
.rt-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.rt-panel__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

@media (max-width: 600px) {
  .rt-panel__grid {
    grid-template-columns: 1fr;
  }
}

.rt-panel__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
}

.rt-panel__card-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.rt-panel__role-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--role-color);
  flex-shrink: 0;
}

.rt-panel__role-name {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rt-panel__field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.rt-panel__label {
  font-size: var(--fs-11);
  color: var(--muted);
  font-weight: 600;
}

.rt-panel__select,
.rt-panel__textarea {
  font-size: var(--fs-xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  padding: 4px 8px;
  font-family: inherit;
  resize: vertical;
}

.rt-panel__select:focus,
.rt-panel__textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.rt-panel__question {
  min-height: 72px;
}

.rt-panel__error {
  font-size: var(--fs-11);
  color: var(--red);
  background: var(--red-soft);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin: 0;
}

.rt-panel__actions {
  display: flex;
  gap: var(--space-2);
}

.rt-panel__btn {
  flex: 1;
  padding: 8px 12px;
  font-size: var(--fs-xs);
  font-weight: 600;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.12s, background 0.12s;
}

.rt-panel__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.rt-panel__btn--primary {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.rt-panel__btn--primary:hover:not(:disabled) {
  background: #4a4fd4;
}

.rt-panel__btn--outline {
  background: transparent;
  color: var(--text);
  border-color: var(--border);
}

.rt-panel__btn--outline:hover:not(:disabled) {
  background: var(--card);
  border-color: var(--muted);
}
</style>
