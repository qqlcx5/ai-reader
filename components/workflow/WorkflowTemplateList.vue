<script lang="ts" setup>
import { onMounted, computed } from 'vue';
import { useWorkflowStore } from '@/stores/workflow.store';
import type { WorkflowTemplate, WorkflowType } from '@/lib/workflow';

const wf = useWorkflowStore();

const emit = defineEmits<{
  (e: 'select', tpl: WorkflowTemplate): void;
}>();

onMounted(() => {
  if (wf.templates.length === 0) {
    void wf.loadTemplates();
  }
});

const filtered = (type: WorkflowType) =>
  computed(() => wf.templates.filter((t) => t.type === type));

const roundtables = filtered('roundtable');
const relays = filtered('relay');
</script>

<template>
  <div class="tpl-list">
    <section class="tpl-list__section">
      <h4 class="tpl-list__heading">圆桌 · Roundtable</h4>
      <ul v-if="roundtables.length" class="tpl-list__items">
        <li
          v-for="tpl in roundtables"
          :key="tpl.id"
          class="tpl-list__item"
          :class="{ 'tpl-list__item--builtin': tpl.builtIn }"
          @click="emit('select', tpl)"
        >
          <div class="tpl-list__name">
            <span>{{ tpl.name }}</span>
            <span v-if="tpl.builtIn" class="tpl-list__badge">内置</span>
          </div>
          <div v-if="tpl.description" class="tpl-list__desc">{{ tpl.description }}</div>
          <div class="tpl-list__meta">{{ tpl.nodes.length }} 个节点</div>
        </li>
      </ul>
      <p v-else class="tpl-list__empty">暂无圆桌模板</p>
    </section>

    <section class="tpl-list__section">
      <h4 class="tpl-list__heading">接力链 · Relay Chain</h4>
      <ul v-if="relays.length" class="tpl-list__items">
        <li
          v-for="tpl in relays"
          :key="tpl.id"
          class="tpl-list__item"
          :class="{ 'tpl-list__item--builtin': tpl.builtIn }"
          @click="emit('select', tpl)"
        >
          <div class="tpl-list__name">
            <span>{{ tpl.name }}</span>
            <span v-if="tpl.builtIn" class="tpl-list__badge">内置</span>
          </div>
          <div v-if="tpl.description" class="tpl-list__desc">{{ tpl.description }}</div>
          <div class="tpl-list__meta">{{ tpl.nodes.length }} 个节点</div>
        </li>
      </ul>
      <p v-else class="tpl-list__empty">暂无接力链模板</p>
    </section>
  </div>
</template>

<style scoped>
.tpl-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.tpl-list__heading {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-11);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted-light);
}

.tpl-list__items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tpl-list__item {
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.tpl-list__item:hover {
  border-color: var(--primary);
  background: var(--panel);
}

.tpl-list__item--builtin {
  border-style: dashed;
}

.tpl-list__name {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text);
}

.tpl-list__badge {
  font-size: var(--fs-11);
  color: var(--primary);
  background: var(--primary-soft);
  padding: 1px 6px;
  border-radius: 999px;
}

.tpl-list__desc {
  margin-top: var(--space-1);
  font-size: var(--fs-11);
  color: var(--muted);
  line-height: 1.5;
}

.tpl-list__meta {
  margin-top: var(--space-2);
  font-size: var(--fs-11);
  color: var(--muted-light);
}

.tpl-list__empty {
  font-size: var(--fs-11);
  color: var(--muted-light);
  font-style: italic;
}
</style>
