<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';
import ThemeProvider from './ThemeProvider.vue';
import ContextStatusBar from './ContextStatusBar.vue';
import ChatWorkspace from '@/components/workspace/ChatWorkspace.vue';
import { useUiStore } from '@/stores/ui.store';
import { useContextStore } from '@/stores/context.store';
import { bindRuntimeListener, on, send, type CommandMessage } from '@/utils/command-bus';
import LoadingDots from '@/components/shared/LoadingDots.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import type { ExtractResponse, TransferMetaMessage, ChunkResponse } from '@/modules/extraction';

const ui = useUiStore();
const ctx = useContextStore();

const emit = defineEmits<{
  (e: 'open-settings'): void;
}>();

const loading = ref(false);
let unsubRuntime: (() => void) | null = null;
let unsubAbort: (() => void) | null = null;

async function getActiveTabId(): Promise<number | undefined> {
  try {
    const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    return tabs[0]?.id;
  } catch {
    return undefined;
  }
}

function setContextFromExtraction(c: { title?: string; url?: string; fullText?: string; rawText?: string; excerpt?: string }) {
  ctx.setContext({
    title: c.title || '',
    url: c.url || '',
    excerpt: c.excerpt || (c.fullText || '').slice(0, 600),
    fullText: c.fullText || '',
    rawText: c.rawText || '',
    mode: 'full',
  });
}

async function refresh() {
  loading.value = true;
  try {
    const tabId = await getActiveTabId();
    if (!tabId) return;

    const response = await browser.tabs.sendMessage(tabId, {
      type: 'EXTRACT_PAGE',
      force: false,
      preferredFormat: 'markdown',
    }) as ExtractResponse | TransferMetaMessage;

    if (response.type === 'EXTRACT_RESULT') {
      if (response.success && response.context) {
        setContextFromExtraction({
          title: response.context.title,
          url: response.context.url,
          fullText: response.context.content,
        });
      }
    } else if (response.type === 'TRANSFER_META') {
      const chunks: string[] = [];
      for (let i = 0; i < response.totalChunks; i++) {
        try {
          const chunkResp = await browser.tabs.sendMessage(tabId, {
            type: 'REQUEST_CHUNK',
            transferId: response.transferId,
            chunkIndex: i,
          }) as ChunkResponse | null;
          if (chunkResp?.type === 'CHUNK_DATA' && chunkResp.chunkData) {
            chunks.push(chunkResp.chunkData);
          }
        } catch { /* skip failed chunk */ }
      }
      const fullContent = chunks.join('');
      setContextFromExtraction({ fullText: fullContent });
    }
  } catch (err) {
    console.warn('[sidepanel] extraction via tabs failed', err);
  } finally {
    loading.value = false;
  }
}

function openHistory() {
  ui.setPanel('history');
}

// Listen for extraction results written to storage by background.ts
function listenForExtraction() {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const data = changes._extraction_result?.newValue;
    if (data && typeof data === 'object') {
      setContextFromExtraction(data as Record<string, string>);
    }
  });
}

// On mount, check if there's already an extraction result in storage
async function loadExistingExtraction() {
  try {
    const result = await chrome.storage.local.get('_extraction_result');
    const data = result._extraction_result as Record<string, string> | undefined;
    if (data && data.fullText) {
      setContextFromExtraction(data);
    }
  } catch { /* best-effort */ }
}

onMounted(() => {
  unsubRuntime = bindRuntimeListener();
  unsubAbort = on('ABORT_ALL_REQUESTS', () => {
    console.log('[sidepanel] ABORT_ALL_REQUESTS received');
  });
  loadExistingExtraction();
  listenForExtraction();
});

onUnmounted(() => {
  unsubRuntime?.();
  unsubAbort?.();
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
