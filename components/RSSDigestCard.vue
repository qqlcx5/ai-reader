<script lang="ts" setup>
import { computed, ref } from 'vue';
import type { RSSDigestItem, RSSCategory } from '@/utils/rss';
import { RSS_CATEGORY_META } from '@/utils/rss';
import {
  Sparkles,
  Check,
  ExternalLink,
  Copy,
  Loader2,
  AlertCircle,
  RotateCcw,
  Star,
  Bookmark,
  Trash2,
} from 'lucide-vue-next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const props = defineProps<{
  digest: RSSDigestItem;
  highlightKeywords?: string[];
}>();

const emit = defineEmits<{
  markAsRead: [id: string];
  retrySummary: [id: string];
  toggleStar: [id: string];
  toggleLaterRead: [id: string];
  deleteDigest: [id: string];
}>();

const copied = ref(false);

const categoryMeta = computed(() => RSS_CATEGORY_META[props.digest.category as RSSCategory] || RSS_CATEGORY_META.custom);

const relativeTime_ = computed(() => {
  const now = dayjs();
  const t = dayjs(props.digest.publishedAt);
  if (now.diff(t, 'minute') < 1) return '刚刚';
  if (now.diff(t, 'hour') < 24) return t.fromNow(true) + '前';
  return t.format('MMM D HH:mm');
});

const highlightedTitle = computed(() => {
  const kws = (props.highlightKeywords || props.digest.matchedKeywords || []).filter(Boolean);
  if (kws.length === 0) return props.digest.title;
  return highlightText(props.digest.title, kws);
});

const highlightedSummary = computed(() => {
  const kws = (props.highlightKeywords || props.digest.matchedKeywords || []).filter(Boolean);
  if (kws.length === 0 || !props.digest.summary) return props.digest.summary;
  return highlightText(props.digest.summary, kws);
});

function highlightText(text: string, keywords: string[]): string {
  if (!text || keywords.length === 0) return text;
  const pattern = new RegExp(`(${keywords.map(escapeRegex).join('|')})`, 'gi');
  return text.replace(pattern, '<mark class="rss-keyword-mark">$1</mark>');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function copySummary() {
  try {
    await navigator.clipboard.writeText(props.digest.summary);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch {}
}

function openOriginal() {
  if (props.digest.url) {
    window.open(props.digest.url, '_blank');
  }
}

function handleMarkAsRead() {
  emit('markAsRead', props.digest.id);
}

function handleRetry() {
  emit('retrySummary', props.digest.id);
}

function handleToggleStar() {
  emit('toggleStar', props.digest.id);
}

function handleToggleLaterRead() {
  emit('toggleLaterRead', props.digest.id);
}

function handleDelete() {
  emit('deleteDigest', props.digest.id);
}
</script>

<template>
  <div
    class="relative pl-5 pb-4 group"
    :class="!digest.isRead && 'border-l-2 border-dashed border-[var(--background-modifier-border)]'"
  >
    <!-- Unread dot -->
    <div
      v-if="!digest.isRead"
      class="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-[var(--text-success)] ring-2 ring-[var(--background-primary)]"
      aria-label="未读"
    />

    <!-- Card (1.html style: rounded-2xl, shadow-card, hover-lift) -->
    <div class="surface-card card-rounded p-4 hover-lift">
      <!-- Header: feed name + category + time -->
      <div class="flex items-center gap-2 mb-1.5 flex-wrap">
        <span
          class="pill !text-[9px] !py-0 !px-1.5 text-white"
          :style="{ backgroundColor: categoryMeta.color }"
        >
          {{ categoryMeta.label }}
        </span>
        <span class="text-[10px] font-medium text-[var(--text-accent)] truncate">
          {{ digest.feedName }}
        </span>
        <span class="text-[10px] text-[var(--text-faint)] shrink-0">
          {{ relativeTime_ }}
        </span>
        <span
          v-if="!digest.isRead"
          class="pill-success !text-[9px] !py-0 !px-1.5 shrink-0"
        >
          New
        </span>
      </div>

      <!-- Title with keyword highlights -->
      <a
        :href="digest.url"
        target="_blank"
        rel="noopener noreferrer"
        class="block text-[var(--font-ui-smaller)] font-medium text-[var(--text-normal)] hover:text-[var(--text-accent)] line-clamp-2 leading-snug mb-2"
        v-html="highlightedTitle"
      />

      <!-- AI tags -->
      <div v-if="digest.aiTags.length > 0" class="flex flex-wrap gap-1 mb-2">
        <span
          v-for="tag in digest.aiTags"
          :key="tag"
          class="pill pill-accent !text-[9px] !py-0"
        >
          {{ tag }}
        </span>
      </div>

      <!-- Summary box -->
      <div
        v-if="digest.summarizing"
        class="flex items-center gap-2 p-2.5 bg-[var(--color-accent-soft)] border-l-2 border-[var(--color-accent)] rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)] text-[var(--font-ui-smallest)] text-[var(--text-muted)]"
      >
        <Loader2 class="w-3 h-3 animate-spin shrink-0" />
        <span>AI 正在总结...</span>
      </div>

      <div
        v-else-if="digest.summaryError"
        class="p-2.5 bg-[var(--background-modifier-error)] border-l-2 border-[var(--text-error)] rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)]"
      >
        <div class="flex items-center gap-1.5 text-[var(--font-ui-smallest)] text-[var(--text-error)] mb-1">
          <AlertCircle class="w-3 h-3 shrink-0" />
          <span>总结失败</span>
        </div>
        <p class="text-[10px] text-[var(--text-muted)] mb-1.5">{{ digest.summaryError }}</p>
        <button
          type="button"
          class="btn-ghost-sm !h-5 !text-[10px]"
          @click="handleRetry"
        >
          <RotateCcw class="w-2.5 h-2.5" />
          重试
        </button>
      </div>

      <div
        v-else-if="digest.summary"
        class="p-2.5 bg-[var(--color-accent-soft)] border-l-2 border-[var(--color-accent)] rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)]"
      >
        <div class="flex items-center gap-1.5 mb-1">
          <Sparkles class="w-3 h-3 text-[var(--text-accent)] shrink-0" />
          <span class="text-[9px] font-medium uppercase tracking-wider text-[var(--text-accent)]">AI Summary</span>
        </div>
        <p
          class="text-[var(--font-ui-smallest)] text-[var(--text-normal)] leading-relaxed whitespace-pre-line"
          v-html="highlightedSummary"
        />
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-1 mt-2 flex-wrap">
        <button
          v-if="!digest.isRead"
          type="button"
          class="btn-ghost-sm !h-5 !text-[10px] gap-1"
          title="标为已读"
          @click="handleMarkAsRead"
        >
          <Check class="w-2.5 h-2.5" />
          已读
        </button>
        <button
          type="button"
          :class="['btn-ghost-sm !h-5 !text-[10px] gap-1', digest.starred && 'text-[var(--text-warning)]']"
          :title="digest.starred ? '取消收藏' : '收藏'"
          @click="handleToggleStar"
        >
          <Star class="w-2.5 h-2.5" :class="digest.starred && 'fill-current'" />
          {{ digest.starred ? '已收藏' : '收藏' }}
        </button>
        <button
          type="button"
          :class="['btn-ghost-sm !h-5 !text-[10px] gap-1', digest.laterRead && 'text-[var(--text-accent)]']"
          :title="digest.laterRead ? '取消稍后读' : '稍后读'"
          @click="handleToggleLaterRead"
        >
          <Bookmark class="w-2.5 h-2.5" :class="digest.laterRead && 'fill-current'" />
          {{ digest.laterRead ? '已加入稍后读' : '稍后读' }}
        </button>
        <button
          v-if="digest.summary"
          type="button"
          class="btn-ghost-sm !h-5 !text-[10px] gap-1"
          title="复制摘要"
          @click="copySummary"
        >
          <component :is="copied ? Check : Copy" class="w-2.5 h-2.5" />
          {{ copied ? '已复制' : '复制' }}
        </button>
        <button
          type="button"
          class="btn-ghost-sm !h-5 !text-[10px] gap-1"
          title="打开原文"
          @click="openOriginal"
        >
          <ExternalLink class="w-2.5 h-2.5" />
          原文
        </button>
        <button
          type="button"
          class="btn-ghost-sm !h-5 !text-[10px] gap-1 ml-auto"
          title="删除"
          @click="handleDelete"
        >
          <Trash2 class="w-2.5 h-2.5" />
          删除
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rss-keyword-mark {
  background-color: var(--color-accent-soft);
  color: var(--text-accent);
  padding: 0 0.125rem;
  border-radius: var(--radius-s);
}
</style>
