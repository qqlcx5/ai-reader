<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useHistoryStore } from '@/stores/history';
import { useContentStore } from '@/stores/content';
import { useComparisonStore } from '@/stores/comparison';
import { useConversationsStore } from '@/stores/conversations';
import { useSettingsStore } from '@/stores/settings';
import { renderMarkdown } from '@/utils/markdown';
import { formatCost } from '@/utils/cost';
import { toMarkdown } from '@/utils/export';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Trash2, ArrowLeft, ExternalLink, Copy, Check,
  Clock, Coins, AlertCircle, ChevronRight, Star, StarOff,
  Search, Heart, RotateCcw,
} from 'lucide-vue-next';
import { browser } from 'wxt/browser';
import BaseState from './base/BaseState.vue';
import BaseButton from './base/BaseButton.vue';
import BaseIconButton from './base/BaseIconButton.vue';
import { getProviderName, getProviderIcon } from '@/utils/providers';

dayjs.extend(relativeTime);

const history = useHistoryStore();
const content = useContentStore();
const comparison = useComparisonStore();
const conversations = useConversationsStore();
const settings = useSettingsStore();

const emit = defineEmits<{
  close: [];
}>();

const viewingEntryId = ref<string | null>(null);
const activeResponseIdx = ref(0);
const copied = ref(false);
const searchQuery = ref('');
const showFavoritesOnly = ref(false);

const viewingEntry = computed(() =>
  viewingEntryId.value ? history.getEntry(viewingEntryId.value) : null
);

const filteredEntries = computed(() => {
  let entries = history.entries;
  if (showFavoritesOnly.value) {
    entries = entries.filter(e => e.favorite);
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    entries = entries.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.url.toLowerCase().includes(q)
    );
  }
  return entries;
});

function formatTime(ts: number): string {
  const now = dayjs();
  const t = dayjs(ts);
  if (now.diff(t, 'minute') < 1) return '刚刚';
  if (now.diff(t, 'hour') < 1) return t.fromNow(true);
  if (now.diff(t, 'day') < 1) return t.format('HH:mm');
  if (now.diff(t, 'day') < 7) return t.format('ddd HH:mm');
  return t.format('MMM D');
}

function formatFull(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm:ss');
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function openDetail(id: string) {
  viewingEntryId.value = id;
  activeResponseIdx.value = 0;
}

function backToList() {
  viewingEntryId.value = null;
}

async function openEntryUrl(url: string) {
  if (!url) return;
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      await browser.tabs.update(tabs[0].id, { url });
    }
  } catch (e) {
    console.error('Failed to navigate:', e);
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch {}
}

async function copyAllResponses() {
  if (!viewingEntry.value) return;
  const md = toMarkdown(
    viewingEntry.value.title,
    viewingEntry.value.url,
    viewingEntry.value.responses.filter(r => r.text).map(r => ({
      providerId: r.providerId,
      modelId: r.modelId,
      text: r.text,
    }))
  );
  try {
    await navigator.clipboard.writeText(md);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch {}
}

function toggleFavorite(id: string) {
  history.toggleFavorite(id);
}

function deleteEntry(id: string) {
  if (viewingEntryId.value === id) {
    viewingEntryId.value = null;
  }
  history.removeEntry(id);
}

async function reusePrompt(prompt: string) {
  if (!content.rawContent) {
    await content.fetchContent();
    if (!content.rawContent) return;
  }
  const fullPrompt = `${prompt}\n\n${content.rawContent}`;
  comparison.initSlots(settings.enabledProviders);
  comparison.startAll(fullPrompt);
  emit('close');
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Detail view -->
    <template v-if="viewingEntry">
      <div class="px-4 py-3 border-b border-[var(--background-modifier-border)] shrink-0">
        <div class="flex items-center gap-2 mb-2">
          <BaseIconButton size="sm" variant="default" aria-label="返回列表" @click="backToList">
            <ArrowLeft class="w-3.5 h-3.5" />
          </BaseIconButton>
          <span class="text-[var(--font-ui-smallest)] text-[var(--text-muted)]">
            {{ formatFull(viewingEntry.timestamp) }}
          </span>
          <div class="ml-auto flex items-center gap-1">
            <BaseIconButton
              size="sm"
              variant="default"
              aria-label="复制全部回答为 Markdown"
              title="复制全部回答"
              @click="copyAllResponses"
            >
              <component :is="copied ? Check : Copy" class="w-3.5 h-3.5" />
            </BaseIconButton>
            <BaseIconButton
              size="sm"
              variant="default"
              aria-label="在浏览器中打开原页面"
              title="在浏览器中打开原页面"
              @click="openEntryUrl(viewingEntry.url)"
            >
              <ExternalLink class="w-3.5 h-3.5" />
            </BaseIconButton>
            <BaseIconButton
              size="sm"
              :variant="viewingEntry.favorite ? 'accent' : 'default'"
              :aria-label="viewingEntry.favorite ? '取消收藏' : '收藏'"
              :title="viewingEntry.favorite ? '取消收藏' : '收藏'"
              @click="toggleFavorite(viewingEntry.id)"
            >
              <component :is="viewingEntry.favorite ? Star : StarOff" class="w-3.5 h-3.5" />
            </BaseIconButton>
            <BaseIconButton
              size="sm"
              variant="danger"
              aria-label="删除记录"
              @click="deleteEntry(viewingEntry.id)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </BaseIconButton>
          </div>
        </div>
        <h2 class="text-[var(--font-ui-medium)] font-semibold text-[var(--text-normal)] line-clamp-2">
          {{ viewingEntry.title }}
        </h2>
        <p class="text-[var(--font-ui-smallest)] text-[var(--text-faint)] mt-0.5 truncate">
          {{ viewingEntry.url }}
        </p>
        <div class="flex items-center gap-2 mt-1.5 text-[10px] text-[var(--text-faint)]">
          <span v-if="viewingEntry.wordCount">{{ viewingEntry.wordCount.toLocaleString() }} 字</span>
          <span>{{ viewingEntry.responses.length }} 个模型回答</span>
          <span v-if="viewingEntry.responses.reduce((s, r) => s + r.estimatedCost, 0) > 0">
            {{ formatCost(viewingEntry.responses.reduce((s, r) => s + r.estimatedCost, 0)) }}
          </span>
        </div>
      </div>

      <!-- Prompt that was sent -->
      <div class="px-4 py-2.5 border-b border-[var(--background-modifier-border)] bg-[var(--background-secondary)] shrink-0">
        <div class="flex items-center gap-1.5 mb-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Prompt</span>
        </div>
        <p class="text-[var(--font-ui-smaller)] text-[var(--text-normal)] line-clamp-3 leading-snug">
          {{ viewingEntry.prompt }}
        </p>
      </div>

      <!-- Model tabs -->
      <div class="flex items-center gap-1 px-3 py-2 border-b border-[var(--background-modifier-border)] overflow-x-auto scrollbar-thin shrink-0">
        <button
          v-for="(r, idx) in viewingEntry.responses"
          :key="idx"
          type="button"
          :class="[
            'flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)] text-[var(--font-ui-smallest)] whitespace-nowrap transition-colors',
            activeResponseIdx === idx
              ? 'bg-[var(--color-accent-soft)] text-[var(--text-accent)]'
              : 'text-[var(--text-muted)] hover:bg-[var(--background-modifier-hover)]',
          ]"
          @click="activeResponseIdx = idx"
        >
          <span :class="['icon', `icon-${getProviderIcon(r.providerId)}`]" style="font-size: 0.75rem" />
          {{ getProviderName(r.providerId) }}
          <span
            v-if="r.status === 'error'"
            class="pill-danger !text-[9px] !py-0"
          >
            <AlertCircle class="w-2 h-2" />
          </span>
        </button>
      </div>

      <!-- Active response content -->
      <div class="flex-1 overflow-y-auto scrollbar-thin">
        <template v-if="viewingEntry.responses[activeResponseIdx]">
          <div class="px-4 py-2.5 border-b border-[var(--background-modifier-border-subtle)] bg-[var(--background-primary)] flex items-center gap-3 text-[var(--font-ui-smallest)] text-[var(--text-muted)] shrink-0">
            <span class="flex items-center gap-1">
              <Clock class="w-3 h-3" />
              {{ formatElapsed(viewingEntry.responses[activeResponseIdx].elapsedMs) }}
            </span>
            <span class="flex items-center gap-1">
              <Coins class="w-3 h-3" />
              {{ viewingEntry.responses[activeResponseIdx].inputTokens }} in / {{ viewingEntry.responses[activeResponseIdx].outputTokens }} out
            </span>
            <span v-if="viewingEntry.responses[activeResponseIdx].estimatedCost > 0" class="pill-success !text-[10px]">
              {{ formatCost(viewingEntry.responses[activeResponseIdx].estimatedCost) }}
            </span>
            <BaseIconButton
              v-if="viewingEntry.responses[activeResponseIdx].text"
              size="sm"
              variant="default"
              class="ml-auto"
              :aria-label="copied ? '已复制' : '复制回答'"
              @click="copyText(viewingEntry.responses[activeResponseIdx].text)"
            >
              <Check v-if="copied" class="w-3 h-3 text-[var(--text-success)]" />
              <Copy v-else class="w-3 h-3" />
            </BaseIconButton>
          </div>

          <div
            v-if="viewingEntry.responses[activeResponseIdx].status === 'error'"
            class="p-4 m-4 bg-[var(--background-modifier-error)] border border-[var(--text-error)] border-opacity-20 rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)] text-[var(--font-ui-smaller)] text-[var(--text-error)]"
          >
            <div class="flex items-center gap-1.5 font-semibold mb-1">
              <AlertCircle class="w-3.5 h-3.5" />
              请求失败
            </div>
            <div>{{ viewingEntry.responses[activeResponseIdx].error || '未知错误' }}</div>
          </div>

          <article
            v-else
            class="prose dark:prose-invert max-w-none p-4 text-[var(--font-ui-smaller)] leading-relaxed"
            v-html="renderMarkdown(viewingEntry.responses[activeResponseIdx].text)"
          />
        </template>
      </div>

      <div class="px-4 py-2 border-t border-[var(--background-modifier-border)] bg-[var(--background-primary)] shrink-0">
        <button
          type="button"
          class="btn-secondary-sm w-full"
          @click="reusePrompt(viewingEntry.prompt)"
        >
          <RotateCcw class="w-3 h-3" />
          用相同提示词在当前页面重新提问
        </button>
      </div>
    </template>

    <!-- List view -->
    <template v-else>
      <!-- Search and filter bar -->
      <div class="px-3 py-2 border-b border-[var(--background-modifier-border)] space-y-2 shrink-0">
        <div class="relative">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)]" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索历史记录…"
            class="input-md pl-8 pr-8 w-full text-[var(--font-ui-smaller)] rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)] rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)]"
            aria-label="搜索历史记录"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-muted)]"
            @click="searchQuery = ''"
            aria-label="清除搜索"
          >
            <span class="text-xs">✕</span>
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            :class="[
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] transition-colors',
              showFavoritesOnly
                ? 'bg-[var(--color-accent-soft)] text-[var(--text-accent)]'
                : 'bg-[var(--background-secondary)] text-[var(--text-muted)] hover:bg-[var(--background-modifier-hover)]',
            ]"
            @click="showFavoritesOnly = !showFavoritesOnly"
          >
            <component :is="showFavoritesOnly ? Star : StarOff" class="w-3 h-3" />
            {{ showFavoritesOnly ? '仅收藏' : '收藏' }}
          </button>
          <span class="text-[10px] text-[var(--text-faint)] ml-auto">
            {{ filteredEntries.length }} 条记录
          </span>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto scrollbar-thin">
        <BaseState
          v-if="filteredEntries.length === 0 && !searchQuery && !showFavoritesOnly"
          variant="empty"
          title="暂无历史记录"
          description="在 Side Panel 提问后会自动保存到这里"
          size="sm"
          class="py-12"
        />

        <BaseState
          v-else-if="filteredEntries.length === 0"
          variant="empty"
          title="没有匹配的记录"
          description="试试其他搜索词或清除筛选条件"
          size="sm"
          class="py-12"
        />

        <button
          v-for="entry in filteredEntries"
          :key="entry.id"
          type="button"
          class="w-full text-left p-4 border-b border-[var(--background-modifier-border-subtle)] hover:bg-[var(--background-modifier-hover)] transition-all group focus-visible:outline-none focus-visible:bg-[var(--background-modifier-hover)]"
          @click="openDetail(entry.id)"
        >
          <div class="flex items-start gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <h4 class="text-[var(--font-ui-smaller)] font-bold text-[var(--text-normal)] line-clamp-1 flex-1 min-w-0 group-hover:text-[var(--text-accent)] transition-colors">
                  {{ entry.title }}
                </h4>
                <button
                  v-if="entry.favorite"
                  type="button"
                  class="shrink-0 text-[var(--text-accent)]"
                  @click.stop="toggleFavorite(entry.id)"
                  aria-label="取消收藏"
                >
                  <Star class="w-3 h-3 fill-current" />
                </button>
              </div>
              <p class="text-[10px] text-[var(--text-faint)] mt-0.5 truncate">
                {{ entry.url }}
              </p>
              <p class="text-[var(--font-ui-smallest)] text-[var(--text-muted)] mt-1 line-clamp-2 italic leading-snug">
                "{{ entry.summary }}"
              </p>
              <div class="flex items-center gap-1.5 mt-1.5">
                <span
                  v-for="r in entry.responses.slice(0, 4)"
                  :key="r.providerId"
                  class="pill-neutral !text-[9px] !py-0"
                  :title="`${getProviderName(r.providerId)} (${r.modelId})`"
                >
                  <span :class="['icon', `icon-${getProviderIcon(r.providerId)}`]" style="font-size: 0.625rem" />
                </span>
                <span v-if="entry.responses.length > 4" class="text-[9px] text-[var(--text-faint)]">
                  +{{ entry.responses.length - 4 }}
                </span>
                <span class="text-[9px] text-[var(--text-faint)] ml-auto font-mono">
                  {{ formatTime(entry.timestamp) }}
                </span>
              </div>
            </div>
            <ChevronRight class="w-3.5 h-3.5 text-[var(--text-faint)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
          </div>
        </button>
      </div>

      <div v-if="history.entries.length > 0" class="flex items-center justify-between px-4 py-2 border-t border-[var(--background-modifier-border)] shrink-0">
        <span class="text-[10px] text-[var(--text-faint)]">
          累计 {{ history.entries.length }} 条 · {{ formatCost(history.totalCost) }}
        </span>
        <BaseButton variant="ghost" size="sm" aria-label="清除所有历史" @click="history.clear()">
          <Trash2 class="w-3 h-3" />
          Clear All
        </BaseButton>
      </div>
    </template>
  </div>
</template>
