<script lang="ts" setup>
import { ref } from 'vue';
import ThemeProvider from './ThemeProvider.vue';
import ContextSummary from './ContextSummary.vue';
import ActionBar from './ActionBar.vue';
import { useUiStore } from '@/stores/ui.store';
import { openSidePanelAndExtract, broadcastAbort, isChromeSidePanelAvailable } from '@/utils/browser';

const ui = useUiStore();
const busy = ref(false);

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
  width: 320px;
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
