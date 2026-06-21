<script lang="ts" setup>
import { ref } from 'vue';
import ThemeProvider from './ThemeProvider.vue';
import NavTabs, { type NavTab } from '@/components/shared/NavTabs.vue';
import SyncOptionsPanel from '@/components/export/SyncOptionsPanel.vue';
import ProviderConfigForm from '@/components/settings/ProviderConfigForm.vue';
import PromptManager from '@/components/settings/PromptManager.vue';
import RssConfigPanel from '@/components/settings/RssConfigPanel.vue';
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
          <ProviderConfigForm v-if="activeTab === 'provider'" />
          <PromptManager v-else-if="activeTab === 'prompts'" />
          <SyncOptionsPanel v-else-if="activeTab === 'sync'" />
          <RssConfigPanel v-else-if="activeTab === 'rss'" />
          <div v-else-if="activeTab === 'advanced'" class="options__advanced">
            <h2 class="options__panel-title">高级设置</h2>
            <p class="options__panel-desc">快捷键、主题、实验功能。</p>
            <div class="adv-section">
              <div class="adv-row">
                <span>快捷键</span>
                <span class="mono muted">Alt+S 唤起 · Alt+P 切换</span>
              </div>
              <label class="adv-row">
                <span>启用快捷键</span>
                <input type="checkbox" :checked="ui.shortcutEnabled" @change="ui.setShortcutEnabled(($event.target as HTMLInputElement).checked)" />
              </label>
            </div>
            <div class="adv-section">
              <div class="adv-row">
                <span>当前主题</span>
                <span class="mono muted">{{ ui.isDark ? '暗色' : '亮色' }}</span>
              </div>
              <div class="adv-row">
                <span>切换主题</span>
                <button class="adv-btn" @click="ui.toggleTheme()">
                  {{ ui.isDark ? '☀ 亮色' : '☾ 暗色' }}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </ThemeProvider>
</template>

<style scoped>
.options {
  min-height: 100vh;
  width: 600px;
  height: 600px;
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
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.adv-section {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.adv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-xs);
}

.adv-btn {
  font-size: var(--fs-xs);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  cursor: pointer;
}
.adv-btn:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
}
</style>
