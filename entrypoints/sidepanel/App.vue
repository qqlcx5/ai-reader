<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import ChatPage from './pages/ChatPage.vue';
import SearchPage from './pages/SearchPage.vue';
import TimelinePage from './pages/TimelinePage.vue';
import DocumentList from './components/DocumentList.vue';
import { onMessage } from '@/shared/messaging/runtime-client';
import { MessageType } from '@/shared/messaging/messages';
import { useDocumentsStore } from '@/stores/documents';
import { useChatStore } from '@/stores/chat';

type Tab = 'chat' | 'search' | 'timeline' | 'list';

const currentTab = ref<Tab>('list');
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'list', label: '文档', icon: '📚' },
  { id: 'chat', label: '对话', icon: '💬' },
  { id: 'search', label: '搜索', icon: '🔍' },
  { id: 'timeline', label: '时间轴', icon: '📅' },
];

const documentsStore = useDocumentsStore();
const chatStore = useChatStore();

const currentDocument = computed(() => documentsStore.currentDocument);

function openOptions() {
  chrome.runtime.openOptionsPage?.();
}

onMounted(async () => {
  // 加载文档列表
  await documentsStore.loadDocuments();
  // 初始化搜索索引
  try {
    const { initIndex } = await import('@/core/search/index-coordinator');
    await initIndex();
  } catch (err) {
    console.warn('[ReadChat] initIndex:', err);
  }
});

// 监听来自 background 的事件
onMessage(async (envelope) => {
  if (envelope.type === MessageType.CHAT_STREAM_CHUNK) {
    const p = envelope.payload as { documentId: string; delta: string; done: boolean };
    if (p.delta) {
      chatStore.appendDelta(p.documentId, p.delta);
    }
    if (p.done) {
      chatStore.finishStreaming(p.documentId);
    }
  }
  return undefined;
});
</script>

<template>
  <div class="sidepanel">
    <header class="header">
      <h1 class="title">📖 ReadChat</h1>
      <a
        href="#"
        class="settings-link"
        @click.prevent="openOptions"
        title="设置"
      >
        ⚙️
      </a>
    </header>

    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        :class="['tab', { active: currentTab === t.id }]"
        @click="currentTab = t.id"
      >
        <span class="tab-icon">{{ t.icon }}</span>
        <span class="tab-label">{{ t.label }}</span>
      </button>
    </nav>

    <main class="content">
      <DocumentList
        v-if="currentTab === 'list'"
        @open-chat="(doc) => {
          documentsStore.setCurrentDocument(doc);
          currentTab = 'chat';
        }"
      />
      <ChatPage
        v-else-if="currentTab === 'chat'"
        :document="currentDocument"
      />
      <SearchPage
        v-else-if="currentTab === 'search'"
        @open-doc="(doc) => {
          documentsStore.setCurrentDocument(doc);
          currentTab = 'chat';
        }"
      />
      <TimelinePage
        v-else-if="currentTab === 'timeline'"
        @open-doc="(doc) => {
          documentsStore.setCurrentDocument(doc);
          currentTab = 'chat';
        }"
      />
    </main>
  </div>
</template>

<style scoped>
.sidepanel {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.settings-link {
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 18px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}
.settings-link:hover {
  background: var(--color-bg-secondary);
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  flex-shrink: 0;
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  transition: all 0.15s;
}
.tab:hover {
  background: var(--color-bg-secondary);
}
.tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
.tab-icon {
  font-size: 18px;
}

.content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
