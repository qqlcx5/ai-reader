<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';
import ThemeProvider from './ThemeProvider.vue';
import ContextStatusBar from './ContextStatusBar.vue';
import ChatWorkspace from '@/components/workspace/ChatWorkspace.vue';
import { useUiStore } from '@/stores/ui.store';
import { useContextStore } from '@/stores/context.store';
import { openSidePanelAndExtract } from '@/utils/browser';
import { bindRuntimeListener, on, send, type CommandMessage } from '@/utils/command-bus';
import LoadingDots from '@/components/shared/LoadingDots.vue';
import EmptyState from '@/components/shared/EmptyState.vue';

const ui = useUiStore();
const ctx = useContextStore();

const emit = defineEmits<{
  (e: 'open-settings'): void;
}>();

const loading = ref(false);
let unsubRuntime: (() => void) | null = null;
let unsubAbort: (() => void) | null = null;
let unsubExtract: (() => void) | null = null;

async function refresh() {
  loading.value = true;
  try {
    await send('EXTRACT_PAGE');
  } finally {
    setTimeout(() => {
      loading.value = false;
    }, 600);
  }
}

function openHistory() {
  ui.setPanel('history');
}

onMounted(() => {
  unsubRuntime = bindRuntimeListener();
  unsubAbort = on('ABORT_ALL_REQUESTS', () => {
    console.log('[sidepanel] ABORT_ALL_REQUESTS received');
  });
  unsubExtract = on('EXTRACT_PAGE', (msg: CommandMessage) => {
    // Hook for M2 — actual extraction happens in content script.
    console.log('[sidepanel] EXTRACT_PAGE received', msg);
  });
});

onUnmounted(() => {
  unsubRuntime?.();
  unsubAbort?.();
  unsubExtract?.();
});
</script>

<template>
  <ThemeProvider>
    <div class="side-panel">
      <ContextStatusBar
        @refresh="refresh"
        @open-history="openHistory"
      />
      <main class="side-panel__main">
        <div v-if="loading" class="side-panel__loading">
          <LoadingDots size="md" />
          <span class="muted">正在提取…</span>
        </div>
        <EmptyState
          v-else-if="!ctx.currentContext.url"
          title="还没有页面上下文"
          description="按 Alt+S 唤起并提取，或点击上方的 ↻ 按钮"
          icon="✦"
          size="lg"
        />
        <div v-else class="side-panel__workspace">
          <ChatWorkspace />
        </div>
      </main>
      <footer class="side-panel__foot">
        <span class="mono muted">{{ ui.activePanel }}</span>
        <span class="muted-light">·</span>
        <span class="muted">{{ ctx.currentContext.mode || 'full' }}</span>
      </footer>
    </div>
  </ThemeProvider>
</template>

<style scoped>
.side-panel {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
}

.side-panel__main {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--space-3) var(--space-3);
  display: flex;
  flex-direction: column;
}

.side-panel__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: var(--space-7);
  font-size: var(--fs-xs);
}

.side-panel__workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.workspace-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-card {
  padding: var(--space-6);
  text-align: center;
  max-width: 360px;
}

.placeholder-title {
  font-size: var(--fs-sm);
  font-weight: 700;
  margin-bottom: var(--space-2);
  color: var(--text);
}

.placeholder-desc {
  font-size: var(--fs-xs);
  line-height: 1.6;
}

.side-panel__foot {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 10px;
  padding: 6px 12px;
  border-top: 1px solid var(--border);
  background: var(--panel);
}
</style>
