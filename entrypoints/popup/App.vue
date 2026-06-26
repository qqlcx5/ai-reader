<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { documentRepository } from '@/core/documents/document.repository';
import type { CapturedDocument } from '@/db/schema';

const recentDocs = ref<CapturedDocument[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    recentDocs.value = await documentRepository.getRecent(5);
  } catch (err) {
    console.error('Failed to load documents:', err);
  } finally {
    loading.value = false;
  }
});

async function openSidePanel(documentId?: string) {
  try {
    // 尝试通过 chrome API 打开 side panel
    if (chrome.sidePanel) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    }
  } catch (err) {
    console.error('Failed to open side panel:', err);
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}
</script>

<template>
  <div class="w-80 bg-slate-50 font-sans text-slate-800">
    <!-- Header -->
    <div class="bg-brand-500 text-white p-4">
      <h1 class="text-lg font-bold">📖 ReadChat</h1>
      <p class="text-sm text-brand-100 mt-1">AI 阅读助手</p>
    </div>

    <!-- Quick Actions -->
    <div class="p-4 space-y-3">
      <button
        class="w-full btn-primary text-center"
        @click="openSidePanel()"
      >
        打开侧边栏对话
      </button>

      <div class="text-xs text-slate-500 text-center">
        或点击页面右下角的 📖 按钮捕获网页
      </div>
    </div>

    <!-- Recent Documents -->
    <div class="border-t border-slate-200">
      <div class="px-4 py-2 text-xs font-medium text-slate-500">
        最近捕获
      </div>

      <div v-if="loading" class="px-4 py-4 text-center text-slate-400 text-sm">
        加载中...
      </div>

      <div v-else-if="recentDocs.length === 0" class="px-4 py-4 text-center text-slate-400 text-sm">
        暂无捕获记录
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div
          v-for="doc in recentDocs"
          :key="doc.id"
          class="px-4 py-2 hover:bg-slate-100 cursor-pointer transition-colors"
          @click="openSidePanel(doc.id)"
        >
          <div class="text-sm text-slate-700 truncate">{{ doc.title }}</div>
          <div class="flex items-center justify-between mt-1">
            <span class="text-xs text-slate-400 truncate">{{ doc.url }}</span>
            <span class="text-xs text-slate-400 ml-2 flex-shrink-0">
              {{ formatDate(doc.createdAt) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-slate-200 p-3 text-center">
      <button
        class="text-xs text-brand-600 hover:underline"
        @click="openSidePanel()"
      >
        管理所有文档 →
      </button>
    </div>
  </div>
</template>
