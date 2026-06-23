<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { pageRepo } from '@/modules/storage/repositories/page.repo';
import { messageRepo } from '@/modules/storage/repositories/message.repo';
import type { PageRecord, MessageRecord } from '@/modules/storage/types';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ breaks: true, linkify: true });

const pages = ref<PageRecord[]>([]);
const selectedPage = ref<PageRecord | null>(null);
const messages = ref<MessageRecord[]>([]);
const searchKeyword = ref('');
const activeTab = ref<'content' | 'chat'>('content');

async function loadPages() {
  pages.value = await pageRepo.listRecent({ limit: 200 });
}

async function selectPage(page: PageRecord) {
  selectedPage.value = page;
  activeTab.value = 'content';
  messages.value = [];
  if (page.conversationId) {
    const result = await messageRepo.listByConversationId(page.conversationId, { limit: 500 });
    messages.value = result.items;
  }
}

const filteredPages = computed(() => {
  if (!searchKeyword.value.trim()) return pages.value;
  const lower = searchKeyword.value.toLowerCase();
  return pages.value.filter(
    p =>
      p.title.toLowerCase().includes(lower) ||
      p.url.toLowerCase().includes(lower) ||
      p.content.rawText.toLowerCase().includes(lower),
  );
});

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const renderedContent = computed(() => {
  if (!selectedPage.value?.content.rawText) return '';
  return md.render(selectedPage.value.content.rawText);
});

onMounted(loadPages);

watch(searchKeyword, async (kw) => {
  if (kw.trim()) {
    pages.value = await pageRepo.search(kw, 100);
  } else {
    await loadPages();
  }
});
</script>

<template>
  <div class="page-library">
    <div class="library-sidebar">
      <div class="library-search">
        <input
          v-model="searchKeyword"
          class="library-search__input"
          type="search"
          placeholder="搜索标题、正文…"
        />
        <span class="library-count muted">{{ filteredPages.length }} 页</span>
      </div>
      <div class="library-list">
        <div
          v-for="page in filteredPages"
          :key="page.id"
          class="library-list__item"
          :class="{ 'library-list__item--active': selectedPage?.id === page.id }"
          @click="selectPage(page)"
        >
          <div class="library-item__title">{{ page.title || page.url }}</div>
          <div class="library-item__meta muted">
            <span>{{ hostname(page.url) }}</span>
            <span>·</span>
            <span>{{ relativeTime(page.timestamp) }}</span>
            <span>·</span>
            <span>{{ page.content.wordCount }} 字</span>
          </div>
        </div>
        <div v-if="filteredPages.length === 0" class="library-empty muted">
          暂无记录
        </div>
      </div>
    </div>
    <div class="library-viewer">
      <template v-if="selectedPage">
        <div class="viewer-tabs">
          <button
            class="viewer-tab"
            :class="{ 'viewer-tab--active': activeTab === 'content' }"
            @click="activeTab = 'content'"
          >正文快照</button>
          <button
            class="viewer-tab"
            :class="{ 'viewer-tab--active': activeTab === 'chat' }"
            @click="activeTab = 'chat'"
          >对话记录</button>
        </div>
        <div class="viewer-body">
          <div v-if="activeTab === 'content'" class="viewer-content markdown-body" v-html="renderedContent" />
          <div v-else class="viewer-chat">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="chat-msg"
              :class="`chat-msg--${msg.role}`"
            >
              <div class="chat-msg__role muted">{{ msg.role === 'user' ? '你' : 'AI' }}</div>
              <div class="chat-msg__content">
                <template v-if="msg.role === 'assistant'">
                  <div
                    v-for="r in msg.modelResponses"
                    :key="r.providerId"
                    class="chat-msg__response"
                    v-html="md.render(r.content || '')"
                  />
                </template>
                <span v-else>{{ msg.content }}</span>
              </div>
            </div>
            <div v-if="messages.length === 0" class="muted">暂无对话记录</div>
          </div>
        </div>
      </template>
      <div v-else class="library-viewer__empty muted">
        从左侧选择一个页面查看
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-library {
  display: flex;
  height: 100%;
  min-height: 500px;
  gap: 0;
}

.library-sidebar {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.library-search {
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border);
}

.library-search__input {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 6px 10px;
  font-size: var(--fs-xs);
  background: var(--bg);
  color: var(--text);
  outline: none;
}

.library-search__input:focus {
  border-color: var(--primary);
}

.library-count {
  font-size: 11px;
  white-space: nowrap;
}

.library-list {
  flex: 1;
  overflow-y: auto;
}

.library-list__item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}

.library-list__item:hover,
.library-list__item--active {
  background: var(--primary-soft);
}

.library-item__title {
  font-size: var(--fs-xs);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.library-item__meta {
  font-size: 11px;
  display: flex;
  gap: 4px;
  margin-top: 2px;
}

.library-empty {
  padding: 24px;
  text-align: center;
}

.library-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.library-viewer__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: var(--fs-xs);
}

.viewer-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  padding: 0 12px;
  gap: 0;
}

.viewer-tab {
  padding: 10px 16px;
  font-size: var(--fs-xs);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: var(--muted);
  font-weight: 500;
}

.viewer-tab--active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.viewer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.viewer-content {
  line-height: 1.7;
  font-size: var(--fs-xs);
}

.chat-msg {
  margin-bottom: 16px;
}

.chat-msg__role {
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chat-msg--user .chat-msg__role {
  color: var(--primary);
}

.chat-msg__content {
  font-size: var(--fs-xs);
  line-height: 1.6;
}
</style>
