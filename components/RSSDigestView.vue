<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRSSStore } from '@/stores/rss';
import { browser } from 'wxt/browser';
import { Rss, RefreshCw, CheckCheck, BookOpen, Filter } from 'lucide-vue-next';
import RSSDigestCard from './RSSDigestCard.vue';
import RSSFilterPanel from './RSSFilterPanel.vue';
import BaseState from './base/BaseState.vue';
import BaseButton from './base/BaseButton.vue';
import BaseIconButton from './base/BaseIconButton.vue';

const rss = useRSSStore();
const showFilter = ref(true);

const digests = computed(() => rss.filteredDigests);
const unreadCount = computed(() => rss.unreadCount);
const allKeywords = computed(() => {
  const kws = new Set<string>();
  for (const kw of rss.filter.whitelistKeywords) kws.add(kw);
  for (const d of digests.value) {
    for (const kw of d.matchedKeywords || []) kws.add(kw);
  }
  return Array.from(kws);
});

function handleRefresh() {
  rss.refreshFeeds();
}

function handleMarkAllRead() {
  rss.markAllAsRead();
}

function handleMarkAsRead(id: string) {
  rss.markAsRead(id);
}

function handleRetrySummary(id: string) {
  browser.runtime.sendMessage({ action: 'rss-retry-summary', digestId: id }).catch(() => {});
}

function handleToggleStar(id: string) {
  rss.toggleStar(id);
}

function handleToggleLaterRead(id: string) {
  rss.toggleLaterRead(id);
}

function handleDeleteDigest(id: string) {
  rss.removeDigest(id);
}

// Listen for digest updates from background
function onDigestUpdated(message: { action: string }) {
  if (message.action === 'rss-digest-updated') {
    rss.load();
  }
}

onMounted(() => {
  rss.load();
  browser.runtime.onMessage.addListener(onDigestUpdated);
});

onUnmounted(() => {
  browser.runtime.onMessage.removeListener(onDigestUpdated);
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header bar (1.html style) -->
    <div class="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--background-modifier-border)] bg-[var(--background-primary)] shrink-0">
      <Rss class="w-3.5 h-3.5 text-[var(--text-accent)] shrink-0" />
      <h2 class="text-[var(--font-ui-smaller)] font-bold text-[var(--text-normal)]">RSS 晨报</h2>
      <span
        v-if="unreadCount > 0"
        class="pill-success !text-[10px] !py-0"
      >
        {{ unreadCount }} unread
      </span>
      <div class="ml-auto flex items-center gap-1">
        <BaseIconButton
          size="sm"
          :active="showFilter"
          aria-label="切换筛选面板"
          title="切换筛选面板"
          @click="showFilter = !showFilter"
        >
          <Filter class="w-3.5 h-3.5" />
        </BaseIconButton>
        <button
          type="button"
          class="btn-ghost-sm"
          :disabled="rss.feeds.length === 0"
          title="刷新"
          @click="handleRefresh"
        >
          <RefreshCw class="w-3 h-3" />
        </button>
        <button
          v-if="unreadCount > 0"
          type="button"
          class="btn-ghost-sm"
          title="全部标为已读"
          @click="handleMarkAllRead"
        >
          <CheckCheck class="w-3 h-3" />
          全部已读
        </button>
      </div>
    </div>

    <!-- Filter panel -->
    <div
      v-if="showFilter"
      class="px-3 py-3 border-b border-[var(--background-modifier-border)] shrink-0 bg-[var(--background-primary-alt)]"
    >
      <RSSFilterPanel />
    </div>

    <!-- Digest timeline -->
    <div class="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
      <!-- Empty state -->
      <BaseState
        v-if="digests.length === 0"
        variant="empty"
        title="暂无 RSS 简报"
        description="添加 RSS 源后，系统会自动抓取并用 AI 总结最新文章"
        :icon="BookOpen"
        size="md"
        class="py-12"
      >
        <BaseButton variant="primary" size="sm" @click="browser.runtime.openOptionsPage()">
          配置 RSS 源
        </BaseButton>
      </BaseState>

      <!-- Timeline -->
      <div v-else class="space-y-0">
        <RSSDigestCard
          v-for="digest in digests"
          :key="digest.id"
          :digest="digest"
          :highlight-keywords="allKeywords"
          @mark-as-read="handleMarkAsRead"
          @retry-summary="handleRetrySummary"
          @toggle-star="handleToggleStar"
          @toggle-later-read="handleToggleLaterRead"
          @delete-digest="handleDeleteDigest"
        />
      </div>
    </div>
  </div>
</template>
