<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import ThemeProvider from './ThemeProvider.vue';
import { useContextStore } from '@/stores/context.store';
import { openSidePanel, isChromeSidePanelAvailable } from '@/utils/browser';

const ctx = useContextStore();
const busy = ref(false);

const title = computed(() => ctx.currentContext?.title || '未提取页面');
const wordCount = computed(() => ctx.currentContext?.wordCount ?? 0);
const domain = computed(() => {
  try { return new URL(ctx.currentContext?.url || '').hostname; } catch { return '—'; }
});
const estimatedTokens = computed(() => Math.round(wordCount.value * 1.3));
const hasContext = computed(() => !!ctx.currentContext?.url);

function loadFromStorage(data: Record<string, string>) {
  ctx.setContext({
    title: data.title || '',
    url: data.url || '',
    excerpt: data.excerpt || (data.fullText || '').slice(0, 600),
    fullText: data.fullText || '',
    rawText: data.rawText || '',
    wordCount: data.wordCount ? parseInt(data.wordCount) : 0,
    mode: 'full',
  });
}

onMounted(async () => {
  try {
    const r = await chrome.storage.local.get('_extraction_result');
    const data = r._extraction_result as Record<string, string> | undefined;
    if (data?.fullText) loadFromStorage(data);
  } catch {}

  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const d = changes._extraction_result?.newValue as Record<string, string> | undefined;
      if (d?.fullText) loadFromStorage(d);
    });
  }
});

async function onExtract() {
  busy.value = true;
  try {
    const resp = await browser.runtime.sendMessage({ type: 'TRIGGER_EXTRACTION' }) as
      { ok: boolean; title?: string; url?: string; fullText?: string; wordCount?: number } | undefined;
    if (resp?.ok && resp.fullText) {
      ctx.setContext({
        title: resp.title || '',
        url: resp.url || '',
        fullText: resp.fullText,
        rawText: resp.fullText,
        wordCount: resp.wordCount,
        mode: 'full',
      });
    }
    await openSidePanel();
  } catch {}
  finally { busy.value = false; }
}

function onOpenSettings() {
  try { (browser as any).runtime?.openOptionsPage?.(); } catch {}
}
</script>

<template>
  <ThemeProvider>
    <div class="popup">
      <!-- Header -->
      <header class="popup__head">
        <div class="popup__brand">
          <div class="popup__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect width="16" height="16" rx="4" fill="var(--primary)" />
              <text x="8" y="11.5" text-anchor="middle" fill="white" font-size="8" font-weight="800" font-family="system-ui">AR</text>
            </svg>
          </div>
          <span class="popup__name">AI Reader</span>
        </div>
        <span v-if="!isChromeSidePanelAvailable()" class="popup__warn">Side Panel 不可用</span>
      </header>

      <!-- Page info card -->
      <div class="popup__body">
        <div class="popup__card">
          <div class="popup__card-head">
            <span class="popup__card-label">当前页面</span>
            <span v-if="hasContext" class="popup__status-dot" aria-hidden="true"></span>
          </div>
          <div class="popup__card-title" :title="ctx.currentContext?.url || ''">
            {{ title }}
          </div>
          <div class="popup__card-meta">
            <span class="popup__meta-item mono">{{ wordCount.toLocaleString() }} 字</span>
            <span class="popup__meta-sep">·</span>
            <span class="popup__meta-item mono">≈ {{ estimatedTokens.toLocaleString() }} tokens</span>
            <span v-if="domain !== '—'" class="popup__meta-sep">·</span>
            <span v-if="domain !== '—'" class="popup__meta-domain muted">{{ domain }}</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="popup__actions">
          <button
            class="popup__btn popup__btn--primary"
            :disabled="busy"
            @click="onExtract"
          >
            <span v-if="busy" class="popup__btn-spinner" aria-hidden="true"></span>
            <span v-else aria-hidden="true">⚡</span>
            触发一键解析
          </button>
          <button
            class="popup__btn popup__btn--secondary"
            @click="onOpenSettings"
          >
            <span aria-hidden="true">⚙</span>
            Options 设置页
          </button>
        </div>
      </div>

      <!-- Footer -->
      <footer class="popup__foot">
        <span class="muted-light">v0.1.0</span>
        <span class="muted-light">·</span>
        <span class="muted-light">Esc 中断生成</span>
        <span class="muted-light">·</span>
        <span class="muted-light">Alt+S 唤起</span>
      </footer>
    </div>
  </ThemeProvider>
</template>

<style scoped>
.popup {
  width: 330px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--panel);
  border: 1.5px solid var(--border-strong);
  border-radius: var(--radius-xl);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.08);
  animation: popup-enter 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes popup-enter {
  from { opacity: 0; transform: scale(0.95) translateY(-4px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.popup__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--card);
}

.popup__brand {
  display: flex;
  align-items: center;
  gap: 7px;
}

.popup__icon {
  flex-shrink: 0;
  display: flex;
}

.popup__name {
  font-size: var(--fs-xs);
  font-weight: 800;
  color: var(--text);
  letter-spacing: 0.02em;
}

.popup__warn {
  font-size: 10px;
  color: var(--orange);
  background: var(--orange-soft);
  padding: 2px 7px;
  border-radius: var(--radius-pill);
  font-weight: 600;
}

.popup__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.popup__card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.popup__card-head {
  display: flex;
  align-items: center;
  gap: 5px;
}

.popup__card-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.popup__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
}

.popup__card-title {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.popup__card-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.popup__meta-item {
  font-size: 11px;
  color: var(--muted);
}

.popup__meta-sep {
  font-size: 11px;
  color: var(--muted-light);
}

.popup__meta-domain {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.popup__actions {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.popup__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 9px 14px;
  font-size: var(--fs-xs);
  font-weight: 700;
  border-radius: var(--radius-lg);
  transition: background 0.12s, border-color 0.12s, opacity 0.12s;
  cursor: pointer;
  border: 1.5px solid transparent;
}

.popup__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.popup__btn--primary {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(91, 96, 229, 0.25);
}

.popup__btn--primary:hover:not(:disabled) {
  background: var(--primary-strong);
  border-color: var(--primary-strong);
}

.popup__btn--secondary {
  background: var(--panel);
  color: var(--text);
  border-color: var(--border);
}

.popup__btn--secondary:hover {
  background: var(--card);
  border-color: var(--border-strong);
}

.popup__btn-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.popup__foot {
  display: flex;
  gap: 5px;
  align-items: center;
  font-size: 10px;
  padding: 7px 12px;
  border-top: 1px solid var(--border);
  background: var(--card);
}
</style>
