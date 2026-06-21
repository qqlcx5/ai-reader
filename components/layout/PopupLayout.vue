<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import ThemeProvider from './ThemeProvider.vue';
import ContextSummary from './ContextSummary.vue';
import ActionBar from './ActionBar.vue';
import { useUiStore } from '@/stores/ui.store';
import { useContextStore } from '@/stores/context.store';
import { openSidePanelAndExtract, isChromeSidePanelAvailable } from '@/utils/browser';

const ui = useUiStore();
const ctx = useContextStore();
const busy = ref(false);

// On mount, check if there's already an extraction result in storage
async function checkExtractionResult() {
  try {
    const result = await chrome.storage.local.get('_extraction_result');
    const data = result._extraction_result as Record<string, string> | undefined;
    if (data && data.fullText) {
      ctx.setContext({
        title: data.title || '',
        url: data.url || '',
        excerpt: data.excerpt || data.fullText.slice(0, 600),
        fullText: data.fullText || '',
        rawText: data.rawText || '',
        mode: 'full',
      });
    }
  } catch { /* best-effort */ }
}

// Listen for new extraction results
function listenForExtraction() {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const d = changes._extraction_result?.newValue;
    if (d && typeof d === 'object') {
      const data = d as Record<string, string>;
      if (data.fullText) {
        ctx.setContext({
          title: data.title || '',
          url: data.url || '',
          excerpt: data.excerpt || data.fullText.slice(0, 600),
          fullText: data.fullText || '',
          rawText: data.rawText || '',
          mode: 'full',
        });
      }
    }
  });
}

onMounted(() => {
  checkExtractionResult();
  listenForExtraction();
});

async function onOpenSidePanel() {
  busy.value = true;
  try {
    await openSidePanelAndExtract();
  } finally {
    busy.value = false;
  }
}

async function onExtract() {
  busy.value = true;
  try {
    await openSidePanelAndExtract();
  } finally {
    busy.value = false;
  }
}

function onOpenSettings() {
  try {
    (browser as any).runtime?.openOptionsPage?.();
  } catch {
    /* best-effort */
  }
}
</script>

<template>
  <ThemeProvider>
    <div class="popup surface">
      <header class="popup__head">
        <div class="popup__brand">
          <span class="popup__logo" aria-hidden="true">✦</span>
          <span class="popup__name">AI Reader</span>
        </div>
        <div class="popup__head-actions">
          <span v-if="!isChromeSidePanelAvailable()" class="popup__hint">Side Panel API 不可用</span>
        </div>
      </header>
      <ContextSummary />
      <ActionBar :busy="busy" @open-side-panel="onOpenSidePanel" @extract="onExtract" @open-settings="onOpenSettings" />
      <footer class="popup__foot muted">
        <span>v0.1.0</span>
        <span class="popup__dot" aria-hidden="true">·</span>
        <span>Esc 中断生成</span>
      </footer>
    </div>
  </ThemeProvider>
</template>

<style scoped>
.popup {
  width: 680px;
  max-width: 100vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-xl);
}

.popup__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}

.popup__brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 800;
  font-size: var(--fs-xs);
}

.popup__logo {
  color: var(--primary);
  font-size: 14px;
}

.popup__name {
  letter-spacing: 0.04em;
}

.popup__hint {
  font-size: 10px;
  color: var(--orange);
  background: var(--orange-soft);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
}

.popup__foot {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 10px;
  padding: 6px 12px;
  border-top: 1px solid var(--border);
  background: var(--card);
}

.popup__dot {
  opacity: 0.5;
}
</style>
