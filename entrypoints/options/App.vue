<script setup lang="ts">
import { ref } from 'vue';
import ModelSettings from './ModelSettings.vue';
import WebDAVSettings from './WebDAVSettings.vue';
import PromptSettings from './PromptSettings.vue';

type TabKey = 'models' | 'webdav' | 'prompts';

const activeTab = ref<TabKey>('models');

const tabs: { key: TabKey; label: string }[] = [
  { key: 'models', label: '模型配置' },
  { key: 'prompts', label: '提示词' },
  { key: 'webdav', label: 'WebDAV 同步' },
];
</script>

<template>
  <div class="min-h-screen bg-slate-50 font-sans text-slate-800">
    <div class="max-w-3xl mx-auto py-8 px-4">
      <h1 class="text-2xl font-bold text-slate-900 mb-6">ReadChat 设置</h1>

      <!-- Tab Navigation -->
      <nav class="flex gap-1 mb-6 bg-white rounded-lg p-1 border border-slate-200">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors"
          :class="activeTab === tab.key
            ? 'bg-brand-500 text-white'
            : 'text-slate-600 hover:bg-slate-100'"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <!-- Content -->
      <ModelSettings v-if="activeTab === 'models'" />
      <PromptSettings v-else-if="activeTab === 'prompts'" />
      <WebDAVSettings v-else-if="activeTab === 'webdav'" />
    </div>
  </div>
</template>
