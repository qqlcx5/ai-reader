<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import ThemeProvider from './ThemeProvider.vue';
import ContextSummary from './ContextSummary.vue';
import ActionBar from './ActionBar.vue';
import { useUiStore } from '@/stores/ui.store';
import { useContextStore } from '@/stores/context.store';
import { openSidePanel, isChromeSidePanelAvailable } from '@/utils/browser';

const ui = useUiStore();
const ctx = useContextStore();
const busy = ref(false);

function loadFromStorage(data: Record<string, string>) {
  ctx.setContext({
    title: data.title || '',
    url: data.url || '',
    excerpt: data.excerpt || (data.fullText || '').slice(0, 600),
    fullText: data.fullText || '',
    rawText: data.rawText || '',
    mode: 'full',
  });
}

async function checkExtractionResult() {
  try {
    const r = await chrome.storage.local.get('_extraction_result');
    const data = r._extraction_result as Record<string, string> | undefined;
    if (data?.fullText) loadFromStorage(data);
  } catch {}
}

function listenForExtraction() {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const d = changes._extraction_result?.newValue as Record<string, string> | undefined;
    if (d?.fullText) loadFromStorage(d);
  });
}

onMounted(() => {
  checkExtractionResult();
  listenForExtraction();
});

async function onOpenSidePanel() {
  busy.value = true;
  try {
    await openSidePanel();
  } finally {
    busy.value = false;
  }
}

async function onExtract() {
  busy.value = true;
  try {
    const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    const tabId = tabs[0]?.id;
    if (tabId) {
      try {
        const resp = await browser.runtime.sendMessage({ type: 'TRIGGER_EXTRACTION' }) as
          { ok: boolean; title?: string; url?: string; fullText?: string };
        if (resp?.ok && resp.fullText) {
          loadFromStorage({ title: resp.title || '', url: resp.url || '', fullText: resp.fullText });
        }
      } catch {}
    }
    await openSidePanel();
  } finally {
    busy.value = false;
  }
}

function onOpenSettings() {
  try {
    (browser as any).runtime?.openOptionsPage?.();
  } catch {}
}
</script>

<template>
  <ThemeProvider>
    <div class="popup surface">
      <header class="popup__head">
        <div class="popup__brand">
          <span class="popup__logo" aria-hidden="true">✦</span>
          <span class="popup__name">ReadChat Clipper</span>
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
