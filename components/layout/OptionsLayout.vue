<script lang="ts" setup>
import { ref, computed } from 'vue';
import ThemeProvider from './ThemeProvider.vue';
import NavTabs, { type NavTab } from '@/components/shared/NavTabs.vue';
import SyncOptionsPanel from '@/components/export/SyncOptionsPanel.vue';
import { useUiStore } from '@/stores/ui.store';

const ui = useUiStore();

const tabs: NavTab[] = [
  { id: 'provider', label: 'Provider', icon: '⚡' },
  { id: 'prompts', label: 'Prompts', icon: '✎' },
  { id: 'sync', label: 'Sync', icon: '⇅' },
  { id: 'rss', label: 'RSS', icon: '☰' },
  { id: 'advanced', label: 'Advanced', icon: '⚙' },
];

const activeTab = ref(tabs[0].id);

const placeholder = computed(() => {
  switch (activeTab.value) {
    case 'provider':
      return {
        title: 'Provider 配置',
        desc: 'M3 模块已就绪。可在此配置 OpenAI / Anthropic / Gemini / Custom Provider 的 API Key、Base URL、模型名。',
      };
    case 'prompts':
      return { title: '提示词模板', desc: '管理 AI Reader 的内置提示词与自定义模板（M5 工作流）。' };
    case 'rss':
      return { title: 'RSS 订阅', desc: '订阅源管理、刷新频率、摘要策略（M8 模块）。' };
    case 'advanced':
      return { title: '高级设置', desc: '快捷键、主题、实验功能。' };
    default:
      return { title: '', desc: '' };
  }
});

function onTabChange(id: string) {
  activeTab.value = id;
}
</script>

<template>
  <ThemeProvider>
    <div class="options">
      <header class="options__head surface-glass">
        <div class="options__brand">
          <span class="options__logo" aria-hidden="true">✦</span>
          <span class="options__title">AI Reader · Settings</span>
        </div>
        <div class="options__theme">
          <button
            class="theme-toggle"
            :aria-pressed="ui.isDark"
            :title="ui.isDark ? '切换到亮色' : '切换到暗色'"
            @click="ui.toggleTheme()"
          >
            {{ ui.isDark ? '☾' : '☀' }}
          </button>
        </div>
      </header>
      <div class="options__body">
        <div class="options__tabs">
          <NavTabs v-model="activeTab" :tabs="tabs" size="md" @change="onTabChange" />
        </div>
        <section class="options__panel surface">
          <SyncOptionsPanel v-if="activeTab === 'sync'" />
          <template v-else>
            <h2 class="options__panel-title">{{ placeholder.title }}</h2>
            <p class="options__panel-desc">{{ placeholder.desc }}</p>
            <div v-if="activeTab === 'advanced'" class="options__advanced">
              <div class="adv-row">
                <span>快捷键</span>
                <span class="mono muted">Alt+S 唤起 · Alt+P 切换 · Esc 中断</span>
              </div>
              <div class="adv-row">
                <span>主题</span>
                <span class="mono muted">{{ ui.theme }}</span>
              </div>
              <div class="adv-row">
                <span>启用快捷键</span>
                <span class="mono muted">{{ ui.shortcutEnabled ? '是' : '否' }}</span>
              </div>
            </div>
          </template>
        </section>
      </div>
    </div>
  </ThemeProvider>
</template>

<style scoped>
.options {
  min-height: 100vh;
  background: var(--bg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.options__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: var(--radius-xl);
}

.options__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: var(--fs-sm);
}

.options__logo {
  color: var(--primary);
  font-size: 16px;
}

.options__theme .theme-toggle {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 14px;
}

.options__theme .theme-toggle:hover {
  background: var(--primary-soft);
  color: var(--primary);
}

.options__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.options__tabs {
  width: 100%;
  display: flex;
  justify-content: center;
}

.options__tabs :deep(.nav-tabs) {
  width: 100%;
  max-width: 720px;
}

.options__panel {
  padding: 24px;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.options__panel-title {
  margin: 0;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text);
}

.options__panel-desc {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--muted);
  line-height: 1.6;
}

.options__advanced {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.adv-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-xs);
}
</style>
