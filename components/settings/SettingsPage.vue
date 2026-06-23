<script lang="ts" setup>
/**
 * 中栏宽屏设置页（v0.8 重构）
 *
 * 接入 6 个孤儿设置组件，按 4 个子 Tab 组织：
 *  - Provider 密钥（ProviderConfigForm，apiKey 走 key-store）
 *  - 提示词模板（PromptManager）
 *  - 同步备份（SyncOptionsPanel + ImportPanel，含 ExportProgressModal）
 *  - RSS 订阅（RssConfigPanel）
 *
 * 设计依据：`doc/proposal_v1.md` §3.1.3「Options 设置页：分 Tab 布局管理」。
 * 右栏「设置」「导出」Tab 仅保留状态概览 + 跳转入口，不再承载完整表单。
 */
import { ref } from 'vue';
import ProviderConfigForm from './ProviderConfigForm.vue';
import PromptManager from './PromptManager.vue';
import SyncOptionsPanel from '@/components/export/SyncOptionsPanel.vue';
import ImportPanel from '@/components/export/ImportPanel.vue';
import RssConfigPanel from './RssConfigPanel.vue';

type SettingsTab = 'providers' | 'prompts' | 'sync' | 'rss';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'providers', label: 'Provider 密钥' },
  { id: 'prompts',   label: '提示词模板' },
  { id: 'sync',      label: '同步备份' },
  { id: 'rss',       label: 'RSS 订阅' },
];

const activeTab = ref<SettingsTab>('providers');
</script>

<template>
  <div class="settings-page">
    <!-- Sub-tab bar -->
    <nav class="settings-page__tabs" role="tablist" aria-label="设置子分类">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="settings-page__tab"
        :class="{ 'settings-page__tab--active': activeTab === tab.id }"
        role="tab"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <!-- Tab panels -->
    <div class="settings-page__body">
      <ProviderConfigForm v-if="activeTab === 'providers'" />

      <PromptManager v-else-if="activeTab === 'prompts'" />

      <div v-else-if="activeTab === 'sync'" class="settings-page__stack">
        <SyncOptionsPanel />
        <ImportPanel />
      </div>

      <RssConfigPanel v-else-if="activeTab === 'rss'" />
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--panel);
}

/* Sub-tab bar — 复用 RightPanelTabs 的视觉语言（border-bottom 激活态） */
.settings-page__tabs {
  display: flex;
  gap: 4px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  flex-shrink: 0;
}

.settings-page__tab {
  position: relative;
  padding: 12px 14px;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--muted);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
  white-space: nowrap;
  margin-bottom: -1px;
}

.settings-page__tab:hover {
  color: var(--text);
  background: var(--card);
}

.settings-page__tab--active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

/* Body — 独立滚动容器 */
.settings-page__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 32px;
}

.settings-page__stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
