<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useRSSStore } from '@/stores/rss';
import { type RSSCategory, RSS_CATEGORY_META } from '@/utils/rss';
import {
  Filter,
  XCircle,
  Search,
  Clock,
  Star,
  BookOpen,
  Check,
  Tag,
  Layers,
} from 'lucide-vue-next';
import BaseInput from './base/BaseInput.vue';
import BaseIconButton from './base/BaseIconButton.vue';

const rss = useRSSStore();

const searchQuery = ref('');
const whitelistInput = ref('');
const blacklistInput = ref('');

const ageOptions = [
  { value: 0, label: '全部时间' },
  { value: 24, label: '24小时' },
  { value: 168, label: '7天' },
  { value: 720, label: '30天' },
];

const activeFilterCount = computed(() => {
  let count = 0;
  if (rss.filter.selectedCategories.length > 0) count++;
  if (rss.filter.whitelistKeywords.length > 0) count++;
  if (rss.filter.blacklistKeywords.length > 0) count++;
  if (rss.filter.maxAgeHours > 0) count++;
  if (rss.filter.onlyUnread) count++;
  if (rss.filter.onlyStarred) count++;
  if (rss.filter.onlyLaterRead) count++;
  if (searchQuery.value.trim()) count++;
  return count;
});

const filteredCount = computed(() => {
  if (searchQuery.value.trim()) {
    return rss.searchDigests(searchQuery.value).length;
  }
  return rss.filteredDigests.length;
});

function toggleCategory(cat: RSSCategory) {
  rss.toggleCategory(cat);
}

function selectAllCategories() {
  rss.setCategoryFilter(Object.keys(RSS_CATEGORY_META) as RSSCategory[]);
}

function clearCategoryFilter() {
  rss.setCategoryFilter([]);
}

function addWhitelistKeyword() {
  const kw = whitelistInput.value.trim();
  if (!kw) return;
  if (!rss.filter.whitelistKeywords.includes(kw)) {
    rss.setKeywordFilter([...rss.filter.whitelistKeywords, kw], rss.filter.blacklistKeywords);
  }
  whitelistInput.value = '';
}

function addBlacklistKeyword() {
  const kw = blacklistInput.value.trim();
  if (!kw) return;
  if (!rss.filter.blacklistKeywords.includes(kw)) {
    rss.setKeywordFilter(rss.filter.whitelistKeywords, [...rss.filter.blacklistKeywords, kw]);
  }
  blacklistInput.value = '';
}

function removeWhitelistKeyword(kw: string) {
  rss.setKeywordFilter(
    rss.filter.whitelistKeywords.filter((k) => k !== kw),
    rss.filter.blacklistKeywords
  );
}

function removeBlacklistKeyword(kw: string) {
  rss.setKeywordFilter(
    rss.filter.whitelistKeywords,
    rss.filter.blacklistKeywords.filter((k) => k !== kw)
  );
}

function handleAgeChange(e: Event) {
  const value = Number((e.target as HTMLSelectElement).value);
  rss.setMaxAgeHours(value);
}

function clearAll() {
  rss.clearFilter();
  searchQuery.value = '';
}

function onSearchInput(v: string) {
  searchQuery.value = v;
}
</script>

<template>
  <div class="space-y-3">
    <!-- Header / search row -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1 min-w-0">
        <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)]" />
        <BaseInput
          :model-value="searchQuery"
          type="search"
          placeholder="搜索标题或摘要..."
          aria-label="搜索 RSS 摘要"
          class="!pl-7"
          @update:model-value="onSearchInput"
        />
      </div>
      <BaseIconButton
        size="sm"
        variant="default"
        aria-label="清除筛选"
        title="清除筛选"
        :disabled="activeFilterCount === 0"
        @click="clearAll"
      >
        <XCircle class="w-3.5 h-3.5" />
      </BaseIconButton>
    </div>

    <!-- Category chips -->
    <div class="flex flex-wrap items-center gap-1.5">
      <div class="flex items-center gap-1 text-[var(--text-faint)] text-[10px]">
        <Layers class="w-3 h-3" />
        <span>分类</span>
      </div>
      <button
        type="button"
        class="btn-ghost-sm !h-5 !text-[10px]"
        @click="selectAllCategories"
      >
        全选
      </button>
      <button
        type="button"
        class="btn-ghost-sm !h-5 !text-[10px]"
        @click="clearCategoryFilter"
      >
        全部
      </button>
      <button
        v-for="cat in rss.categories"
        :key="cat.category"
        type="button"
        :class="[
          'pill !text-[10px] !py-0 transition-colors',
          cat.active ? 'text-white' : 'bg-[var(--background-secondary)] text-[var(--text-muted)]',
        ]"
        :style="cat.active ? { backgroundColor: cat.color } : undefined"
        @click="toggleCategory(cat.category)"
      >
        <Check v-if="cat.active" class="w-2.5 h-2.5" />
        {{ cat.label }}
        <span class="opacity-70">{{ cat.count }}</span>
      </button>
    </div>

    <!-- Keywords -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <!-- Whitelist -->
      <div class="space-y-1.5">
        <div class="flex items-center gap-1 text-[var(--text-faint)] text-[10px]">
          <Tag class="w-3 h-3" />
          <span>白名单关键词</span>
        </div>
        <div class="relative">
          <BaseInput
            v-model="whitelistInput"
            placeholder="输入后回车添加"
            aria-label="白名单关键词"
            @keydown.enter.prevent="addWhitelistKeyword"
          />
        </div>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="kw in rss.filter.whitelistKeywords"
            :key="kw"
            class="pill pill-accent !text-[10px] !py-0 cursor-pointer"
            @click="removeWhitelistKeyword(kw)"
          >
            {{ kw }}
            <XCircle class="w-2.5 h-2.5" />
          </span>
        </div>
      </div>

      <!-- Blacklist -->
      <div class="space-y-1.5">
        <div class="flex items-center gap-1 text-[var(--text-faint)] text-[10px]">
          <Filter class="w-3 h-3" />
          <span>黑名单关键词</span>
        </div>
        <div class="relative">
          <BaseInput
            v-model="blacklistInput"
            placeholder="输入后回车添加"
            aria-label="黑名单关键词"
            @keydown.enter.prevent="addBlacklistKeyword"
          />
        </div>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="kw in rss.filter.blacklistKeywords"
            :key="kw"
            class="pill pill-danger !text-[10px] !py-0 cursor-pointer"
            @click="removeBlacklistKeyword(kw)"
          >
            {{ kw }}
            <XCircle class="w-2.5 h-2.5" />
          </span>
        </div>
      </div>
    </div>

    <!-- Match options & age & states -->
    <div class="flex flex-wrap items-center gap-3 text-[var(--font-ui-smallest)]">
      <label class="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          class="checkbox-base"
          :checked="rss.filter.matchInTitle"
          @change="rss.setMatchInTitle(($event.target as HTMLInputElement).checked)"
        />
        <span>匹配标题</span>
      </label>
      <label class="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          class="checkbox-base"
          :checked="rss.filter.matchInSummary"
          @change="rss.setMatchInSummary(($event.target as HTMLInputElement).checked)"
        />
        <span>匹配摘要</span>
      </label>
      <div class="flex items-center gap-1.5">
        <Clock class="w-3 h-3 text-[var(--text-faint)]" />
        <select
          class="select-base !h-6 !text-[10px]"
          :value="rss.filter.maxAgeHours"
          aria-label="时间范围"
          @change="handleAgeChange"
        >
          <option v-for="opt in ageOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <button
        type="button"
        :class="['pill !text-[10px] !py-0', rss.filter.onlyUnread ? 'pill-success' : 'pill-neutral']"
        @click="rss.setOnlyUnread(!rss.filter.onlyUnread)"
      >
        <BookOpen class="w-2.5 h-2.5" />
        未读
      </button>
      <button
        type="button"
        :class="['pill !text-[10px] !py-0', rss.filter.onlyStarred ? 'pill-warning' : 'pill-neutral']"
        @click="rss.setOnlyStarred(!rss.filter.onlyStarred)"
      >
        <Star class="w-2.5 h-2.5" />
        收藏
      </button>
      <button
        type="button"
        :class="['pill !text-[10px] !py-0', rss.filter.onlyLaterRead ? 'pill-accent' : 'pill-neutral']"
        @click="rss.setOnlyLaterRead(!rss.filter.onlyLaterRead)"
      >
        <BookOpen class="w-2.5 h-2.5" />
        稍后读
      </button>
    </div>

    <!-- Result count -->
    <div class="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
      <Filter class="w-3 h-3" />
      <span>显示 {{ filteredCount }} 条结果</span>
      <span v-if="activeFilterCount > 0" class="pill pill-accent !text-[9px] !py-0">
        {{ activeFilterCount }} 个筛选条件
      </span>
    </div>
  </div>
</template>
