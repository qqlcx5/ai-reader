<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRSSStore } from '@/stores/rss';
import {
  Rss,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  Download,
  Upload,
  RotateCw,
  CheckCheck,
  FolderOpen,
  X,
  Layers,
  Bell,
  Clock,
  Settings2,
} from 'lucide-vue-next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import BaseInput from './base/BaseInput.vue';
import BaseButton from './base/BaseButton.vue';
import BaseIconButton from './base/BaseIconButton.vue';
import BaseTextarea from './base/BaseTextarea.vue';
import { RSS_CATEGORY_META, type RSSCategory, parseRSS } from '@/utils/rss';

dayjs.extend(relativeTime);

const rss = useRSSStore();

const activeTab = ref<'feeds' | 'settings' | 'import'>('feeds');
const newUrl = ref('');
const newName = ref('');
const showAddForm = ref(false);
const importing = ref(false);
const editingFeedId = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const categoryOptions = computed(() =>
  Object.entries(RSS_CATEGORY_META).map(([key, meta]) => ({ value: key as RSSCategory, label: meta.label }))
);

const feedsByCategory = computed(() => {
  const groups = new Map<RSSCategory, typeof rss.feeds>();
  for (const feed of rss.feeds) {
    if (!groups.has(feed.category)) groups.set(feed.category, []);
    groups.get(feed.category)!.push(feed);
  }
  return Array.from(groups.entries()).map(([category, feeds]) => ({
    category,
    label: RSS_CATEGORY_META[category]?.label || category,
    color: RSS_CATEGORY_META[category]?.color,
    feeds,
  }));
});

function formatLastFetched(ts: number): string {
  if (!ts) return '从未';
  return dayjs(ts).fromNow();
}

async function handleAdd() {
  if (!newUrl.value.trim()) return;
  const url = newUrl.value.trim();
  const name = newName.value.trim();
  await rss.addFeed(url, name || undefined);
  const added = rss.feeds.find((f) => f.url === url);
  if (added && added.autoName && (!added.name || added.name === url)) {
    tryFetchFeedTitle(added);
  }
  newUrl.value = '';
  newName.value = '';
  showAddForm.value = false;
}

async function tryFetchFeedTitle(feed: typeof rss.feeds[0]) {
  try {
    const res = await fetch(feed.url, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    });
    if (!res.ok) return;
    const xml = await res.text();
    const parsed = parseRSS(xml);
    if (parsed.title) {
      await rss.updateFeed(feed.id, { name: parsed.title });
    }
  } catch {
    // ignore
  }
}

async function handleRemove(id: string) {
  await rss.removeFeed(id);
}

async function handleToggle(id: string) {
  await rss.toggleFeed(id);
}

async function handleRefreshFeed(id: string) {
  await rss.refreshFeed(id);
}

async function handleMarkAllRead() {
  await rss.markAllAsRead();
}

async function handleClearRead() {
  await rss.clearReadDigests();
}

async function updateFeedField(id: string, field: keyof typeof rss.feeds[0], value: any) {
  await rss.updateFeed(id, { [field]: value });
}

function handleExportOPML() {
  const opml = rss.exportFeedsOPML();
  const blob = new Blob([opml], { type: 'text/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-reader-rss-${new Date().toISOString().slice(0, 10)}.opml`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImportClick() {
  fileInput.value?.click();
}

async function handleImportOPML(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  importing.value = true;
  try {
    const text = await file.text();
    await rss.importFeedsOPML(text);
  } finally {
    importing.value = false;
    target.value = '';
  }
}

function toggleEdit(id: string) {
  editingFeedId.value = editingFeedId.value === id ? null : id;
}

onMounted(() => {
  rss.load();
});
</script>

<template>
  <section class="space-y-6">
    <header class="section-header">
      <div>
        <h2 class="section-title">RSS</h2>
        <p class="section-subtitle">配置 RSS 源、过滤规则与全局设置</p>
      </div>
      <div class="flex items-center gap-2">
        <BaseButton variant="secondary" size="sm" aria-label="刷新所有 RSS 源" @click="rss.refreshFeeds">
          <template #icon-left><RefreshCw class="w-3.5 h-3.5" /></template>
          Refresh Now
        </BaseButton>
        <BaseButton variant="primary" size="sm" aria-label="添加 RSS 源" @click="showAddForm = !showAddForm">
          <template #icon-left><Plus class="w-3.5 h-3.5" /></template>
          Add Feed
        </BaseButton>
      </div>
    </header>

    <!-- Tabs -->
    <div class="flex items-center gap-1 border-b border-[var(--background-modifier-border)]">
      <button
        type="button"
        :class="['px-3 py-1.5 text-[var(--font-ui-smaller)]', activeTab === 'feeds' && 'border-b-2 border-[var(--text-accent)] text-[var(--text-accent)]']"
        @click="activeTab = 'feeds'"
      >
        <Layers class="w-3.5 h-3.5 inline-block mr-1" />
        Feeds
      </button>
      <button
        type="button"
        :class="['px-3 py-1.5 text-[var(--font-ui-smaller)]', activeTab === 'settings' && 'border-b-2 border-[var(--text-accent)] text-[var(--text-accent)]']"
        @click="activeTab = 'settings'"
      >
        <Settings2 class="w-3.5 h-3.5 inline-block mr-1" />
        Settings
      </button>
      <button
        type="button"
        :class="['px-3 py-1.5 text-[var(--font-ui-smaller)]', activeTab === 'import' && 'border-b-2 border-[var(--text-accent)] text-[var(--text-accent)]']"
        @click="activeTab = 'import'"
      >
        <FolderOpen class="w-3.5 h-3.5 inline-block mr-1" />
        Import / Export
      </button>
    </div>

    <!-- Add form -->
    <div v-if="showAddForm" class="setting-items">
      <div class="p-4 space-y-3">
        <BaseInput
          v-model="newUrl"
          label="Feed URL"
          placeholder="https://example.com/rss.xml"
          aria-label="RSS feed URL"
        />
        <BaseInput
          v-model="newName"
          label="Name (optional)"
          placeholder="自动从 Feed 中获取"
          aria-label="RSS feed name"
        />
        <div class="flex gap-2">
          <BaseButton variant="primary" size="sm" @click="handleAdd">
            <template #icon-left><Check class="w-3.5 h-3.5" /></template>
            Add
          </BaseButton>
          <BaseButton variant="secondary" size="sm" @click="showAddForm = false; newUrl = ''; newName = ''">
            Cancel
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- Feeds tab -->
    <div v-if="activeTab === 'feeds'" class="space-y-4">
      <div class="flex items-center gap-2">
        <BaseButton variant="secondary" size="sm" @click="handleMarkAllRead">
          <template #icon-left><CheckCheck class="w-3.5 h-3.5" /></template>
          全部标为已读
        </BaseButton>
        <BaseButton variant="danger" size="sm" @click="handleClearRead">
          <template #icon-left><Trash2 class="w-3.5 h-3.5" /></template>
          清空已读
        </BaseButton>
      </div>

      <div
        v-for="group in feedsByCategory"
        :key="group.category"
        class="setting-items"
        role="list"
      >
        <div class="px-4 py-2 border-b border-[var(--background-modifier-border)] bg-[var(--background-primary-alt)]">
          <div
            class="inline-flex items-center gap-1.5 pill !text-[10px] !py-0 text-white"
            :style="{ backgroundColor: group.color }"
          >
            <Layers class="w-3 h-3" />
            {{ group.label }}
          </div>
        </div>
        <div
          v-for="feed in group.feeds"
          :key="feed.id"
          class="setting-item"
        >
          <div class="flex-1 min-w-0 space-y-2">
            <div class="flex items-center gap-2">
              <Rss class="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <span class="font-medium text-[var(--text-normal)]">{{ feed.name }}</span>
              <span
                :class="[
                  'pill !text-[9px] !py-0',
                  feed.enabled ? 'pill-success' : 'pill-neutral'
                ]"
              >
                {{ feed.enabled ? 'Enabled' : 'Disabled' }}
              </span>
              <span
                v-if="feed.lastFetchedError"
                class="pill-danger !text-[9px] !py-0"
                :title="feed.lastFetchedError"
              >
                Error
              </span>
            </div>
            <p class="text-[var(--font-ui-smallest)] text-[var(--text-faint)] truncate">
              {{ feed.url }}
            </p>
            <p class="text-[var(--font-ui-smallest)] text-[var(--text-faint)]">
              Last fetched: {{ formatLastFetched(feed.lastFetchedAt) }}
              <span v-if="feed.lastFetchedError" class="text-[var(--text-error)] ml-2">{{ feed.lastFetchedError }}</span>
            </p>

            <!-- Edit form -->
            <div v-if="editingFeedId === feed.id" class="space-y-2 pt-1">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <BaseInput
                  :model-value="feed.name"
                  label="Name"
                  aria-label="Feed name"
                  @update:model-value="(v) => updateFeedField(feed.id, 'name', v)"
                />
                <div>
                  <label class="block text-[var(--font-ui-small)] text-[var(--text-normal)] mb-1">Category</label>
                  <select
                    class="select-base"
                    :value="feed.category"
                    aria-label="Feed category"
                    @change="updateFeedField(feed.id, 'category', ($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
                <BaseInput
                  :model-value="feed.tags.join(', ')"
                  label="Tags (comma separated)"
                  aria-label="Feed tags"
                  @update:model-value="(v) => updateFeedField(feed.id, 'tags', (v as string).split(',').map((t) => t.trim()).filter(Boolean))"
                />
                <div class="flex items-center gap-2">
                  <BaseInput
                    :model-value="feed.fetchIntervalMinutes"
                    type="number"
                    label="Interval (min)"
                    aria-label="Fetch interval minutes"
                    @update:model-value="(v) => updateFeedField(feed.id, 'fetchIntervalMinutes', Number(v))"
                  />
                  <BaseInput
                    :model-value="feed.maxItemsPerFetch"
                    type="number"
                    label="Max items"
                    aria-label="Max items per fetch"
                    @update:model-value="(v) => updateFeedField(feed.id, 'maxItemsPerFetch', Number(v))"
                  />
                </div>
              </div>
              <label class="flex items-center gap-1.5 text-[var(--font-ui-smallest)] cursor-pointer">
                <input
                  type="checkbox"
                  class="checkbox-base"
                  :checked="feed.autoName"
                  @change="updateFeedField(feed.id, 'autoName', ($event.target as HTMLInputElement).checked)"
                />
                自动从 Feed 标题命名
              </label>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              :class="['toggle-track', feed.enabled && 'toggle-track-on']"
              :aria-label="feed.enabled ? '禁用' : '启用'"
              @click="handleToggle(feed.id)"
            >
              <span :class="['toggle-thumb', feed.enabled && 'translate-x-5']" />
            </button>
            <BaseIconButton
              size="sm"
              variant="primary"
              aria-label="编辑 RSS 源"
              :active="editingFeedId === feed.id"
              @click="toggleEdit(feed.id)"
            >
              <Settings2 class="w-3.5 h-3.5" />
            </BaseIconButton>
            <BaseIconButton
              size="sm"
              variant="default"
              aria-label="刷新此 RSS 源"
              title="刷新此 RSS 源"
              @click="handleRefreshFeed(feed.id)"
            >
              <RotateCw class="w-3.5 h-3.5" />
            </BaseIconButton>
            <BaseIconButton
              size="sm"
              variant="danger"
              aria-label="删除 RSS 源"
              @click="handleRemove(feed.id)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </BaseIconButton>
          </div>
        </div>
      </div>

      <div
        v-if="rss.feeds.length === 0"
        class="px-4 py-8 text-center text-[var(--font-ui-smaller)] text-[var(--text-muted)] setting-items"
      >
        暂未配置任何 RSS 源，点击右上角 "Add Feed" 添加
      </div>
    </div>

    <!-- Settings tab -->
    <div v-else-if="activeTab === 'settings'" class="setting-items space-y-4 p-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BaseInput
          :model-value="rss.globalSettings.fetchIntervalMinutes"
          type="number"
          label="默认刷新间隔（分钟）"
          aria-label="Default fetch interval minutes"
          @update:model-value="(v) => rss.updateGlobalSettings({ fetchIntervalMinutes: Number(v) })"
        />
        <BaseInput
          :model-value="rss.globalSettings.summaryMaxChars"
          type="number"
          label="摘要最大字符数"
          aria-label="Summary max chars"
          @update:model-value="(v) => rss.updateGlobalSettings({ summaryMaxChars: Number(v) })"
        />
        <BaseInput
          :model-value="rss.globalSettings.defaultMaxItemsPerFeed"
          type="number"
          label="默认每 Feed 最大条目数"
          aria-label="Default max items per feed"
          @update:model-value="(v) => rss.updateGlobalSettings({ defaultMaxItemsPerFeed: Number(v) })"
        />
        <div>
          <label class="block text-[var(--font-ui-small)] text-[var(--text-normal)] mb-1">Badge 计数模式</label>
          <select
            class="select-base"
            :value="rss.globalSettings.badgeMode"
            aria-label="Badge mode"
            @change="rss.updateGlobalSettings({ badgeMode: ($event.target as HTMLSelectElement).value as any })"
          >
            <option value="unread">未读</option>
            <option value="all">全部</option>
            <option value="starred">收藏</option>
          </select>
        </div>
      </div>
      <BaseTextarea
        :model-value="rss.globalSettings.summaryPrompt"
        label="自定义摘要 Prompt（可用 {title} 和 {content}）"
        :rows="3"
        aria-label="Summary prompt"
        @update:model-value="(v) => rss.updateGlobalSettings({ summaryPrompt: v })"
      />
      <BaseTextarea
        :model-value="rss.globalSettings.tagExtractPrompt"
        label="标签提取 Prompt（可用 {summary}）"
        :rows="3"
        aria-label="Tag extract prompt"
        @update:model-value="(v) => rss.updateGlobalSettings({ tagExtractPrompt: v })"
      />
      <div class="flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-1.5 text-[var(--font-ui-smallest)] cursor-pointer">
          <input
            type="checkbox"
            class="checkbox-base"
            :checked="rss.globalSettings.autoExtractTags"
            @change="rss.updateGlobalSettings({ autoExtractTags: ($event.target as HTMLInputElement).checked })"
          />
          自动提取 AI 标签
        </label>
        <label class="flex items-center gap-1.5 text-[var(--font-ui-smallest)] cursor-pointer">
          <input
            type="checkbox"
            class="checkbox-base"
            :checked="rss.globalSettings.enableNotifications"
            @change="rss.updateGlobalSettings({ enableNotifications: ($event.target as HTMLInputElement).checked })"
          />
          <Bell class="w-3 h-3" />
          新摘要完成时显示通知
        </label>
        <label class="flex items-center gap-1.5 text-[var(--font-ui-smallest)] cursor-pointer">
          <input
            type="checkbox"
            class="checkbox-base"
            :checked="rss.globalSettings.dedupeByTitle"
            @change="rss.updateGlobalSettings({ dedupeByTitle: ($event.target as HTMLInputElement).checked })"
          />
          <Clock class="w-3 h-3" />
          跨 Feed 按标题去重
        </label>
      </div>
    </div>

    <!-- Import/Export tab -->
    <div v-else-if="activeTab === 'import'" class="setting-items space-y-4 p-4">
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">导出 OPML</div>
          <div class="setting-item-description">将当前 RSS 源导出为 OPML 文件，可在其他阅读器导入</div>
        </div>
        <BaseButton variant="primary" size="sm" @click="handleExportOPML">
          <template #icon-left><Download class="w-4 h-4" /></template>
          Export
        </BaseButton>
      </div>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-label">导入 OPML</div>
          <div class="setting-item-description">从 OPML 文件导入 RSS 源</div>
        </div>
        <div class="setting-item-control">
          <BaseButton variant="secondary" size="sm" :loading="importing" @click="handleImportClick">
            <template #icon-left><Upload class="w-4 h-4" /></template>
            Import
          </BaseButton>
          <input ref="fileInput" type="file" accept=".opml,.xml" class="hidden" @change="handleImportOPML" />
        </div>
      </div>
    </div>
  </section>
</template>
