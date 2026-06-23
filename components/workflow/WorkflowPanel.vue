<script lang="ts" setup>
import { ref } from 'vue';
import RoundtablePanel from './RoundtablePanel.vue';
import RelayChainPanel from './RelayChainPanel.vue';
import TemplateList from './TemplateList.vue';
import WorkflowResults from './WorkflowResults.vue';
import { useWorkflowStore } from '@/stores/workflow.store';

type Tab = 'roundtable' | 'relay' | 'templates';

const activeTab = ref<Tab>('roundtable');
const wf = useWorkflowStore();

const emit = defineEmits<{
  (e: 'insert-text', text: string): void;
}>();

const tabs: { id: Tab; label: string }[] = [
  { id: 'roundtable', label: '圆桌' },
  { id: 'relay',      label: '接力链' },
  { id: 'templates',  label: '模板' },
];
</script>

<template>
  <div class="wf-panel">
    <!-- Tab switcher -->
    <div class="wf-panel__tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :class="['wf-panel__tab', { 'wf-panel__tab--active': activeTab === tab.id }]"
        type="button"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Active session results (shown above panel when running) -->
    <WorkflowResults v-if="wf.activeSession" class="wf-panel__results" />

    <!-- Sub-panels -->
    <div v-show="!wf.activeSession || wf.activeSession.status !== 'running'" class="wf-panel__body">
      <RoundtablePanel v-if="activeTab === 'roundtable'" />
      <RelayChainPanel v-else-if="activeTab === 'relay'" />
      <TemplateList
        v-else-if="activeTab === 'templates'"
        @insert="(text) => emit('insert-text', text)"
      />
    </div>
  </div>
</template>

<style scoped>
.wf-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  gap: var(--space-3);
}

.wf-panel__tabs {
  display: flex;
  gap: 2px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 3px;
  flex-shrink: 0;
}

.wf-panel__tab {
  flex: 1;
  padding: 5px 8px;
  font-size: var(--fs-xs);
  font-weight: 500;
  border: none;
  background: transparent;
  color: var(--muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}

.wf-panel__tab:hover {
  background: var(--panel);
  color: var(--text);
}

.wf-panel__tab--active {
  background: var(--panel);
  color: var(--text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.wf-panel__results {
  flex-shrink: 0;
  max-height: 55%;
  overflow-y: auto;
}

.wf-panel__body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>
