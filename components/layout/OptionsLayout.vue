<script lang="ts" setup>
import { computed } from 'vue';
import ThemeProvider from './ThemeProvider.vue';
import ThreeColumnLayout from './ThreeColumnLayout.vue';
import BrandHeader from './BrandHeader.vue';
import MainNav from './MainNav.vue';
import RightPanelTabs from './RightPanelTabs.vue';
import ContextStatusBar from './ContextStatusBar.vue';
import ExtractionStatusBar from './ExtractionStatusBar.vue';
import ChatWorkspace from '@/components/workspace/ChatWorkspace.vue';
import LibraryPage from '@/components/library/LibraryPage.vue';
import SettingsPage from '@/components/settings/SettingsPage.vue';
import { useUiStore } from '@/stores/ui.store';
import { useContextStore } from '@/stores/context.store';

const ui = useUiStore();
const ctx = useContextStore();

/**
 * 中栏路由：MainNav 的 id（chat/history/rss/workflows/export/settings）
 * 映射到中栏视图。settings / library 渲染宽屏管理页，其余渲染 ChatWorkspace。
 *
 * activeRoute 来源 ui store（持久化，刷新后保留），右栏"前往设置页"按钮
 * 通过 ui.setRoute('settings') 触发同一份状态。
 */
const activeRoute = computed<string>(() => ui.activeRoute || 'home');

function onNavigate(id: string) {
  // MainNav id 与 AppRoute 语义对齐：chat → home，其余直接复用
  const route = id === 'chat' ? 'home' : (id as 'home' | 'history' | 'settings' | 'workflows' | 'rss');
  ui.setRoute(route);
  // 同步 panel 状态（影响部分组件的 active 标记）
  if (id === 'chat' || id === 'history') {
    ui.setPanel(id === 'history' ? 'history' : 'chat');
  }
}

async function onRefresh() {
  try {
    const resp = await browser.runtime.sendMessage({ type: 'TRIGGER_EXTRACTION' }) as
      { ok: boolean; title?: string; url?: string; fullText?: string; engine?: string; wordCount?: number } | undefined;
    if (resp?.ok && resp.fullText) {
      ctx.setContext({
        title: resp.title || '',
        url: resp.url || '',
        fullText: resp.fullText,
        rawText: resp.fullText,
        engine: (resp.engine as 'readability' | 'defuddle' | 'fallback') || 'fallback',
        wordCount: resp.wordCount ?? 0,
        mode: 'full',
      });
    }
  } catch {}
}
</script>

<template>
  <ThemeProvider>
    <ThreeColumnLayout>
      <!-- Left column: brand + main navigation -->
      <template #left>
        <BrandHeader />
        <MainNav
          :active-id="activeRoute === 'home' ? 'chat' : activeRoute"
          @navigate="onNavigate"
        />

        <!-- Technical context footer in left column -->
        <div class="options-left__footer">
          <div class="options-left__shortcut">
            <span class="options-left__key">Alt+S</span>
            <span>唤起并提取</span>
          </div>
          <div class="options-left__shortcut">
            <span class="options-left__key">Alt+P</span>
            <span>显隐侧边栏</span>
          </div>
          <div class="options-left__shortcut">
            <span class="options-left__key">Esc</span>
            <span>中断生成</span>
          </div>
          <button class="options-left__theme-btn" @click="ui.toggleTheme()">
            {{ ui.isDark ? '☀ 亮色模式' : '☾ 暗色模式' }}
          </button>
        </div>
      </template>

      <!-- Center column: main workspace -->
      <template #center>
        <div class="options-center">
          <!-- Context anchor bar (64px) — 全局显示，保持上下文锚定 -->
          <ContextStatusBar @refresh="onRefresh" />

          <!-- Extraction status bar (32px) -->
          <ExtractionStatusBar />

          <!-- Chat workspace / Library / Settings -->
          <div class="options-center__workspace">
            <SettingsPage v-if="activeRoute === 'settings'" />
            <LibraryPage v-else-if="activeRoute === 'history'" />
            <ChatWorkspace v-else />
          </div>
        </div>
      </template>

      <!-- Right column: 6-tab panel -->
      <template #right>
        <RightPanelTabs />
      </template>
    </ThreeColumnLayout>
  </ThemeProvider>
</template>

<style scoped>
/* Left column footer */
.options-left__footer {
  padding: 12px 14px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.options-left__shortcut {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--muted);
}

.options-left__key {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  white-space: nowrap;
}

.options-left__theme-btn {
  margin-top: 4px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  text-align: left;
}

.options-left__theme-btn:hover {
  background: var(--primary-soft);
  border-color: #d2d6ff;
  color: var(--primary);
}

/* Center column */
.options-center {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.options-center__workspace {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
</style>
