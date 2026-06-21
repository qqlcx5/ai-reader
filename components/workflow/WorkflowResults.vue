<script lang="ts" setup>
import { computed } from 'vue';
import { useWorkflowStore } from '@/stores/workflow.store';
import StreamingText from '@/components/workspace/StreamingText.vue';

const wf = useWorkflowStore();

const session = computed(() => wf.activeSession);

function statusLabel(status: string): string {
  return {
    pending: '等待中',
    running: '运行中',
    done: '完成',
    error: '错误',
    aborted: '已中断',
  }[status] ?? status;
}

function statusClass(status: string): string {
  return `wf-results__status--${status}`;
}
</script>

<template>
  <div v-if="session" class="wf-results">
    <div class="wf-results__head">
      <div>
        <h3 class="wf-results__title">{{ session.title }}</h3>
        <div class="wf-results__meta">
          <span class="wf-results__type">
            {{ session.type === 'roundtable' ? '圆桌' : '接力链' }}
          </span>
          <span :class="['wf-results__status', statusClass(session.status)]">
            {{ statusLabel(session.status) }}
          </span>
        </div>
      </div>
      <button class="wf-results__close" type="button" @click="wf.clearSession()">关闭</button>
    </div>

    <div class="wf-results__nodes">
      <div v-for="node in session.nodes" :key="node.id" class="wf-results__node">
        <div class="wf-results__node-head">
          <span class="wf-results__node-name">{{ node.name }}</span>
          <span :class="['wf-results__status', statusClass(node.status)]">
            {{ statusLabel(node.status) }}
          </span>
        </div>
        <div class="wf-results__node-body">
          <StreamingText
            v-if="node.status === 'running' || node.status === 'done'"
            :text="node.output"
            :streaming="node.status === 'running'"
          />
          <p v-else-if="node.status === 'aborted'" class="wf-results__hint">运行已中断</p>
          <p v-else-if="node.status === 'error'" class="wf-results__hint wf-results__hint--err">
            节点执行失败
          </p>
          <p v-else class="wf-results__hint">等待执行…</p>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="wf-results wf-results--empty">
    <p class="wf-results__hint">尚未运行工作流</p>
  </div>
</template>

<style scoped>
.wf-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  height: 100%;
  overflow: hidden;
}

.wf-results--empty {
  align-items: center;
  justify-content: center;
  color: var(--muted-light);
}

.wf-results__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
}

.wf-results__title {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--text);
}

.wf-results__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: 4px;
}

.wf-results__type {
  font-size: var(--fs-11);
  background: var(--primary-soft);
  color: var(--primary);
  padding: 1px 6px;
  border-radius: 999px;
}

.wf-results__status {
  font-size: var(--fs-11);
  padding: 1px 6px;
  border-radius: 999px;
}

.wf-results__status--pending {
  background: var(--card);
  color: var(--muted);
}

.wf-results__status--running {
  background: var(--orange-soft);
  color: var(--orange);
}

.wf-results__status--done {
  background: var(--green-soft);
  color: var(--green);
}

.wf-results__status--error {
  background: var(--red-soft);
  color: var(--red);
}

.wf-results__status--aborted {
  background: var(--card);
  color: var(--muted);
}

.wf-results__close {
  font-size: var(--fs-11);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  color: var(--muted);
  cursor: pointer;
}

.wf-results__nodes {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  overflow-y: auto;
  flex: 1;
}

.wf-results__node {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  overflow: hidden;
}

.wf-results__node-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

.wf-results__node-name {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text);
}

.wf-results__node-body {
  padding: var(--space-3);
  font-size: var(--fs-xs);
  color: var(--text);
  line-height: 1.6;
  min-height: 60px;
}

.wf-results__hint {
  color: var(--muted);
  font-size: var(--fs-11);
  font-style: italic;
  margin: 0;
}

.wf-results__hint--err {
  color: var(--red);
}
</style>
