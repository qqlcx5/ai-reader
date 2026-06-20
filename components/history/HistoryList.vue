<script lang="ts" setup>
import { ref, watch, onMounted } from 'vue';
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import type { ConversationRecord, SearchResult } from '@/modules/storage/types';
import { conversationRepo } from '@/modules/storage/repositories/conversation.repo';
import { deepSearchStream, debounce, searchBatchMainThread } from '@/modules/storage/search.service';
import { useUiStore } from '@/stores/ui.store';
import HistoryItem from './HistoryItem.vue';

const uiStore = useUiStore();
const conversations = ref<ConversationRecord[]>([]);
const deepResults = ref<SearchResult[]>([]);
const isSearching = ref(false);

const ITEM_SIZE = 64;

async function loadConversations() {
  const page = await conversationRepo.listRecent({ limit: 100 });
  conversations.value = page.items;
}

onMounted(() => {
  loadConversations();
});

const runSearch = debounce(async (keyword: string) => {
  if (!keyword.trim()) {
    deepResults.value = [];
    isSearching.value = false;
    uiStore.setDeepSearchResults(undefined);
    return;
  }
  isSearching.value = true;
  try {
    // 1. Quick title/preview filter in main thread.
    const titlePage = await conversationRepo.searchByTitle(keyword, { limit: 200 });
    const titleMatchIds = new Set(titlePage.items.map((c) => c.id));

    // 2. Deep content search in Worker on full message batches.
    const results: SearchResult[] = [];
    for await (const batch of deepSearchStream(keyword)) {
      results.push(...batch);
      if (results.length >= 200) break;
    }
    deepResults.value = results;
    uiStore.setDeepSearchResults(results);

    // 3. Merge title matches and conversation IDs from deep search.
    const deepConversationIds = new Set(results.map((r) => r.conversationId));
    const mergedIds = new Set([...titleMatchIds, ...deepConversationIds]);
    if (mergedIds.size > 0) {
      const page = await conversationRepo.listRecent({ limit: 1000 });
      conversations.value = page.items.filter((c) => mergedIds.has(c.id));
    } else {
      conversations.value = [];
    }
  } finally {
    isSearching.value = false;
  }
}, 300);

watch(
  () => uiStore.historySearchKeyword,
  (keyword) => runSearch(keyword),
  { immediate: true },
);

function onItemClick(id: string) {
  uiStore.selectConversation(id);
  uiStore.setPanel('chat');
}
</script>

<template>
  <div class="history-list">
    <div v-if="isSearching" class="searching-hint">深度搜索中…</div>
    <RecycleScroller
      v-if="conversations.length"
      class="scroller"
      :items="conversations"
      :item-size="ITEM_SIZE"
      key-field="id"
      v-slot="{ item }"
    >
      <HistoryItem :conversation="item" @click="onItemClick" />
    </RecycleScroller>
    <div v-else class="empty">暂无历史会话</div>
  </div>
</template>

<style scoped>
.history-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.scroller {
  flex: 1;
}
.empty,
.searching-hint {
  padding: 16px;
  text-align: center;
  color: var(--muted-color, #888);
  font-size: 13px;
}
</style>
