<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import ThemeProvider from './ThemeProvider.vue';
import ContextStatusBar from './ContextStatusBar.vue';
import ChatWorkspace from '@/components/workspace/ChatWorkspace.vue';
import { useUiStore } from '@/stores/ui.store';
import { useContextStore } from '@/stores/context.store';
import { useConversationStore } from '@/stores/conversation.store';
import LoadingDots from '@/components/shared/LoadingDots.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import { getOrCreateSession, updatePageContent } from '@/utils/page-session';

const ui = useUiStore();
const ctx = useContextStore();
const conversation = useConversationStore();

const loading = ref(false);

function setContextFromExtraction(c: { title?: string; url?: string; fullText?: string }) {
  const fullText = c.fullText || '';
  ctx.setContext({
    title: c.title || '',
    url: c.url || '',
    excerpt: fullText.slice(0, 600),
    fullText,
    rawText: fullText,
    mode: 'full',
  });
}

function extractFromStorage(): Promise<boolean> {
  return chrome.storage.local.get('_extraction_result').then((r) => {
    const data = r._extraction_result as Record<string, string> | undefined;
    if (data?.fullText) { setContextFromExtraction(data); return true; }
    return false;
  });
}

async function extractViaBackground(): Promise<boolean> {
  try {
    const resp = await browser.runtime.sendMessage({ type: 'TRIGGER_EXTRACTION' }) as
      { ok: boolean; title?: string; url?: string; fullText?: string } | undefined;
    if (resp?.ok && resp.fullText) {
      setContextFromExtraction({ title: resp.title, url: resp.url, fullText: resp.fullText });
      return true;
    }
  } catch {}
  return false;
}

async function extractViaScripting(tabId: number): Promise<boolean> {
  try {
    const scripting = (chrome as any).scripting;
    if (!scripting?.executeScript) return false;
    const [result] = await scripting.executeScript({
      target: { tabId },
      func: () => {
        const text = document.body?.innerText || document.body?.textContent || '';
        return {
          title: document.title,
          url: location.href,
          content: text.replace(/\n{3,}/g, '\n\n').trim().slice(0, 50000),
        };
      },
    });
    const data = result?.result;
    if (data?.content && data.content.length >= 50) {
      setContextFromExtraction({ title: data.title, url: data.url, fullText: data.content });
      await chrome.storage.local.set({ _extraction_result: data, mode: 'full' }).catch(() => {});
      return true;
    }
  } catch {}
  return false;
}

async function bindPageSession(c: { url?: string; title?: string; fullText?: string }) {
  if (!c.url) return;
  try {
    const session = await getOrCreateSession(c.url, c.title || '', '');
    await conversation.loadConversation(session.conversationId);
    if (c.fullText) {
      await updatePageContent(session.pageId, c.fullText);
    } else if (!c.fullText && session.existingContent?.rawText) {
      ctx.setContext({ fullText: session.existingContent.rawText, rawText: session.existingContent.rawText });
    }
  } catch (err) {
    console.warn('[sidepanel] page-session bind error:', err);
  }
}

async function refresh() {
  loading.value = true;
  try {
    const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    const tabId = tabs[0]?.id;
    console.log('[sidepanel] refresh tabId:', tabId);

    if (tabId) {
      if (await extractViaScripting(tabId).catch(() => false)) {
        await bindPageSession(ctx.currentContext);
        return;
      }
    }

    if (await extractViaBackground()) {
      await bindPageSession(ctx.currentContext);
      return;
    }

    const ok = await extractFromStorage();
    if (ok) {
      await bindPageSession(ctx.currentContext);
    }
  } catch (err) {
    console.warn('[sidepanel] refresh error:', err);
    await extractFromStorage().catch(() => {});
  } finally {
    loading.value = false;
  }
}

function openHistory() {
  ui.setPanel('history');
}

function listenForExtraction() {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const data = changes._extraction_result?.newValue;
    if (data && typeof data === 'object' && (data as Record<string, string>).fullText) {
      setContextFromExtraction(data as Record<string, string>);
    }
  });
}

async function loadExistingExtraction() {
  try {
    const r = await chrome.storage.local.get('_extraction_result');
    const data = r._extraction_result as Record<string, string> | undefined;
    if (data?.fullText) setContextFromExtraction(data);
  } catch {}
}

onMounted(() => {
  loadExistingExtraction();
  listenForExtraction();
  setTimeout(refresh, 300);
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
