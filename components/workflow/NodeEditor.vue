<script lang="ts" setup>
import { computed } from 'vue';
import type { WorkflowNodeSpec } from '@/lib/workflow';
import type { ProviderConfig } from '@/modules/provider';

interface Props {
  node: WorkflowNodeSpec;
  providers: ProviderConfig[];
  /** Available upstreams (for relay: any other node in the same template). */
  upstreamCandidates?: WorkflowNodeSpec[];
  readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  upstreamCandidates: () => [],
  readonly: false,
});

const emit = defineEmits<{
  (e: 'update', patch: Partial<WorkflowNodeSpec>): void;
  (e: 'remove'): void;
}>();

const availableUpstreams = computed(() =>
  props.upstreamCandidates.filter((n) => n.id !== props.node.id),
);

const providerLabel = computed(() => {
  const p = props.providers.find((p) => p.id === props.node.providerId);
  return p ? `${p.name} · ${p.model}` : '未选择 Provider';
});

function toggleUpstream(id: string, checked: boolean): void {
  const set = new Set(props.node.upstreamNodeIds);
  if (checked) set.add(id);
  else set.delete(id);
  emit('update', { upstreamNodeIds: Array.from(set) });
}
</script>

<template>
  <div class="node-editor">
    <div class="node-editor__head">
      <input
        class="node-editor__name"
        :value="node.name"
        :readonly="readonly"
        placeholder="节点名称"
        @input="emit('update', { name: ($event.target as HTMLInputElement).value })"
      />
      <button v-if="!readonly" class="node-editor__remove" type="button" @click="emit('remove')" aria-label="删除节点">
        ×
      </button>
    </div>

    <label class="node-editor__field">
      <span class="node-editor__label">Provider</span>
      <select
        class="node-editor__select"
        :value="node.providerId"
        :disabled="readonly"
        @change="emit('update', { providerId: ($event.target as HTMLSelectElement).value })"
      >
        <option value="" disabled>{{ providerLabel }}</option>
        <option v-for="p in providers" :key="p.id" :value="p.id" :disabled="!p.enabled">
          {{ p.name }} · {{ p.model }}<template v-if="!p.enabled"> · 禁用</template>
        </option>
      </select>
    </label>

    <label class="node-editor__field">
      <span class="node-editor__label">System Prompt</span>
      <textarea
        class="node-editor__textarea"
        :value="node.systemPrompt"
        :readonly="readonly"
        rows="3"
        placeholder="角色 / 任务定义"
        @input="emit('update', { systemPrompt: ($event.target as HTMLTextAreaElement).value })"
      />
    </label>

    <div v-if="availableUpstreams.length" class="node-editor__upstreams">
      <span class="node-editor__label">上游节点 (Relay)</span>
      <ul class="node-editor__upstream-list">
        <li v-for="u in availableUpstreams" :key="u.id">
          <label>
            <input
              type="checkbox"
              :checked="node.upstreamNodeIds.includes(u.id)"
              :disabled="readonly"
              @change="toggleUpstream(u.id, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ u.name || u.id }}</span>
          </label>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.node-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
}

.node-editor__head {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.node-editor__name {
  flex: 1;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
}

.node-editor__remove {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.node-editor__remove:hover {
  background: var(--red-soft);
  color: var(--red);
  border-color: var(--red);
}

.node-editor__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.node-editor__label {
  font-size: var(--fs-11);
  color: var(--muted);
  font-weight: 600;
}

.node-editor__select,
.node-editor__textarea {
  font-size: var(--fs-xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  padding: 4px 8px;
  font-family: inherit;
  resize: vertical;
}

.node-editor__upstreams {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.node-editor__upstream-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.node-editor__upstream-list label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-11);
  color: var(--text);
}
</style>
