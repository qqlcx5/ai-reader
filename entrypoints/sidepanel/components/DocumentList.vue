<script lang="ts" setup>
import { computed } from 'vue';
import { useDocumentsStore } from '@/stores/documents';
import dayjs from 'dayjs';
import type { CapturedDocument } from '@/shared/types';

const emit = defineEmits<{
  (e: 'open-chat', doc: CapturedDocument): void;
}>();

const store = useDocumentsStore();

const documents = computed(() => store.documents);
const loading = computed(() => store.loading);

async function deleteDoc(doc: CapturedDocument, event: Event): Promise<void> {
  event.stopPropagation();
  if (!confirm(`确定删除「${doc.title}」？`)) return;
  await store.deleteDocumentById(doc.id);
}

async function captureCurrentTab(): Promise<void> {
  // 触发 content script 捕获
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'TRIGGER_CAPTURE',
      payload: {},
      timestamp: Date.now(),
    }).catch(() => {
      alert('请刷新页面后再试');
    });
  }
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
</script>

<template>
  <div class="doc-list">
    <div class="action-bar">
      <button class="capture-btn" @click="captureCurrentTab">
        📥 捕获当前页
      </button>
    </div>

    <div v-if="loading" class="empty">加载中...</div>
    <div v-else-if="documents.length === 0" class="empty">
      <div class="empty-icon">📚</div>
      <div>暂无捕获的文档</div>
      <div class="empty-hint">点击「捕获当前页」开始</div>
    </div>
    <div v-else class="docs">
      <div
        v-for="doc in documents"
        :key="doc.id"
        class="doc-item"
        @click="emit('open-chat', doc)"
      >
        <div class="doc-title">{{ doc.title || '无标题' }}</div>
        <div class="doc-meta">
          <span class="doc-domain">{{ doc.siteName || getHostname(doc.url) }}</span>
          <span class="doc-date">{{ dayjs(doc.createdAt).format('MM-DD HH:mm') }}</span>
        </div>
        <button class="doc-delete" @click="deleteDoc(doc, $event)" title="删除">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.doc-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.action-bar {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
}

.capture-btn {
  width: 100%;
  padding: 10px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: opacity 0.15s;
}
.capture-btn:hover {
  opacity: 0.9;
}

.docs {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.doc-item {
  position: relative;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.15s;
}
.doc-item:hover {
  background: var(--color-bg-secondary);
}

.doc-title {
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  padding-right: 24px;
}

.doc-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.doc-domain {
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-delete {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  background: transparent;
  border: none;
  border-radius: 50%;
  font-size: 16px;
  color: var(--color-text-secondary);
  opacity: 0;
  transition: opacity 0.15s;
}
.doc-item:hover .doc-delete {
  opacity: 1;
}
.doc-delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  padding: 40px 16px;
  text-align: center;
}
.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.4;
}
.empty-hint {
  font-size: 12px;
  margin-top: 8px;
  opacity: 0.7;
}
</style>
