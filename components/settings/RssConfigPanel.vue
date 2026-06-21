<script lang="ts" setup>
import { ref } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';

const store = useSettingsStore();

const feedUrl = ref('');
const addingFeed = ref(false);

function addFeed() {
  if (!feedUrl.value.trim()) return;
  const feeds = store.settings.rssConfig as any;
  if (!feeds.feeds) {
    feeds.feeds = [];
  }
  feeds.feeds.push({
    id: crypto.randomUUID(),
    url: feedUrl.value.trim(),
    enabled: true,
    lastFetchedAt: 0,
  });
  store.setSettings({ rssConfig: feeds });
  feedUrl.value = '';
  addingFeed.value = false;
}

function removeFeed(id: string) {
  const feeds = (store.settings.rssConfig as any).feeds || [];
  (store.settings.rssConfig as any).feeds = feeds.filter((f: any) => f.id !== id);
  store.setSettings({ rssConfig: { ...store.settings.rssConfig } });
}

function saveConfig() {
  store.setSettings({ rssConfig: { ...store.settings.rssConfig } });
}
</script>

<template>
  <div class="rss-config">
    <h3 class="rss-title">RSS 订阅</h3>

    <div class="rss-section">
      <label class="rss-row">
        <span>启用 RSS 抓取</span>
        <input type="checkbox" :checked="store.settings.rssConfig.enabled" @change="(e: any) => { store.settings.rssConfig.enabled = e.target.checked; saveConfig() }" />
      </label>

      <label class="rss-row">
        <span>抓取间隔（分钟）</span>
        <input type="number" :value="store.settings.rssConfig.fetchIntervalMinutes" @change="(e: any) => { store.settings.rssConfig.fetchIntervalMinutes = Number(e.target.value); saveConfig() }" min="10" max="1440" />
      </label>

      <label class="rss-row">
        <span>每源最大条目数</span>
        <input type="number" :value="store.settings.rssConfig.maxItemsPerFeed" @change="(e: any) => { store.settings.rssConfig.maxItemsPerFeed = Number(e.target.value); saveConfig() }" min="1" max="200" />
      </label>

      <label class="rss-row">
        <span>启用 AI 摘要</span>
        <input type="checkbox" :checked="store.settings.rssConfig.aiSummaryEnabled" @change="(e: any) => { store.settings.rssConfig.aiSummaryEnabled = e.target.checked; saveConfig() }" />
      </label>
    </div>

    <h4 class="rss-subtitle">订阅源</h4>

    <div v-if="!((store.settings.rssConfig as any).feeds?.length)" class="rss-empty muted">
      还没有订阅源。
    </div>

    <div v-for="feed in (store.settings.rssConfig as any).feeds || []" :key="feed.id" class="rss-feed-card">
      <div class="rss-feed-info">
        <span class="rss-feed-url mono">{{ feed.url }}</span>
        <span v-if="feed.lastError" class="rss-feed-error">{{ feed.lastError.message }}</span>
      </div>
      <button class="rss-btn rss-btn--danger" @click="removeFeed(feed.id)">删除</button>
    </div>

    <div v-if="addingFeed" class="rss-add-form">
      <input v-model="feedUrl" placeholder="RSS Feed URL" class="rss-input" @keyup.enter="addFeed" />
      <div class="rss-add-actions">
        <button class="rss-btn" @click="addingFeed = false">取消</button>
        <button class="rss-btn rss-btn--primary" @click="addFeed" :disabled="!feedUrl.trim()">添加</button>
      </div>
    </div>

    <button v-else class="rss-add-btn" @click="addingFeed = true">+ 添加订阅源</button>
  </div>
</template>

<style scoped>
.rss-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rss-title {
  margin: 0;
  font-size: var(--fs-sm);
  font-weight: 700;
}
.rss-subtitle {
  margin: 0;
  font-size: var(--fs-xs);
  font-weight: 700;
}
.rss-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.rss-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-xs);
}
.rss-row input[type="number"] {
  width: 80px;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  font-size: var(--fs-xs);
}
.rss-empty {
  text-align: center;
  padding: var(--space-4);
  font-size: var(--fs-xs);
}
.rss-feed-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  gap: 8px;
}
.rss-feed-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.rss-feed-url {
  font-size: 10px;
  word-break: break-all;
}
.rss-feed-error {
  font-size: 10px;
  color: var(--red);
}
.rss-btn {
  font-size: var(--fs-xs);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
}
.rss-btn:hover { background: var(--primary-soft); border-color: var(--primary); }
.rss-btn--primary { background: var(--primary); color: #fff; border-color: var(--primary); }
.rss-btn--danger { color: var(--red); border-color: var(--red); }
.rss-btn--danger:hover { background: var(--red-soft); }
.rss-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.rss-add-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rss-input {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  font-size: var(--fs-xs);
}
.rss-input:focus { outline: none; border-color: var(--primary); }
.rss-add-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.rss-add-btn {
  align-self: flex-start;
  font-size: var(--fs-xs);
  padding: 4px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--primary);
  background: var(--primary);
  color: #fff;
  cursor: pointer;
}
.rss-add-btn:hover { opacity: 0.9; }
</style>
