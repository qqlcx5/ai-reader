<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useDocumentStore } from '@/stores/document.store';
import { documentRepository } from '@/core/documents/document.repository';
import { aggregateTimeline, getStats, getDocumentsForDate } from '@/core/timeline/timeline.service';
import type { CapturedDocument, TimelineBucket } from '@/db/schema';
import type { TimelineMode } from '@/core/timeline/timeline.service';
import dayjs from 'dayjs';

const documentStore = useDocumentStore();
const mode = ref<TimelineMode>('day');
const buckets = ref<TimelineBucket[]>([]);
const selectedDate = ref<string | null>(null);
const selectedDocuments = ref<CapturedDocument[]>([]);
const stats = ref({
  total: 0,
  todayCount: 0,
  weekCount: 0,
  streak: 0,
  mostActiveDay: null as { date: string; count: number } | null,
});

// 生成最近 365 天的日期格子
const heatmapDates = computed(() => {
  const dates: { date: string; count: number }[] = [];
  const countMap = new Map(buckets.value.map((b) => [b.date, b.count]));

  for (let i = 364; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
    dates.push({
      date,
      count: countMap.get(date) || 0,
    });
  }
  return dates;
});

const maxCount = computed(() =>
  Math.max(...heatmapDates.value.map((d) => d.count), 1),
);

function getHeatColor(count: number): string {
  if (count === 0) return 'bg-slate-100';
  const ratio = count / maxCount.value;
  if (ratio < 0.25) return 'bg-brand-100';
  if (ratio < 0.5) return 'bg-brand-200';
  if (ratio < 0.75) return 'bg-brand-400';
  return 'bg-brand-600';
}

async function loadData() {
  buckets.value = await aggregateTimeline(mode.value);
  stats.value = await getStats();
}

async function handleDateClick(date: string) {
  selectedDate.value = date;
  selectedDocuments.value = await getDocumentsForDate(date);
}

async function handleDocClick(doc: CapturedDocument) {
  documentStore.setCurrentDocument(doc);
}

onMounted(async () => {
  await loadData();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-y-auto">
    <!-- Stats -->
    <div class="p-4 bg-white border-b border-slate-200">
      <div class="grid grid-cols-4 gap-2 text-center">
        <div>
          <div class="text-xl font-bold text-brand-600">{{ stats.total }}</div>
          <div class="text-xs text-slate-500">总捕获</div>
        </div>
        <div>
          <div class="text-xl font-bold text-brand-600">{{ stats.todayCount }}</div>
          <div class="text-xs text-slate-500">今日</div>
        </div>
        <div>
          <div class="text-xl font-bold text-brand-600">{{ stats.weekCount }}</div>
          <div class="text-xs text-slate-500">本周</div>
        </div>
        <div>
          <div class="text-xl font-bold text-brand-600">{{ stats.streak }}</div>
          <div class="text-xs text-slate-500">连续</div>
        </div>
      </div>
    </div>

    <!-- Mode Selector -->
    <div class="flex gap-1 p-3 bg-white border-b border-slate-200">
      <button
        v-for="m in (['day', 'week', 'month'] as TimelineMode[])"
        :key="m"
        class="px-3 py-1 text-xs rounded-full border transition-colors"
        :class="mode === m
          ? 'bg-brand-500 text-white border-brand-500'
          : 'bg-white text-slate-600 border-slate-300 hover:border-brand-300'"
        @click="mode = m; loadData()"
      >
        {{ m === 'day' ? '日' : m === 'week' ? '周' : '月' }}
      </button>
    </div>

    <!-- Heatmap -->
    <div class="p-4">
      <div class="flex flex-wrap gap-0.5">
        <div
          v-for="item in heatmapDates"
          :key="item.date"
          class="w-3 h-3 rounded-sm cursor-pointer transition-transform hover:scale-150"
          :class="getHeatColor(item.count)"
          :title="`${item.date}: ${item.count} 篇`"
          @click="handleDateClick(item.date)"
        />
      </div>
      <!-- Legend -->
      <div class="flex items-center gap-1 mt-2 text-xs text-slate-400">
        <span>少</span>
        <div class="w-3 h-3 rounded-sm bg-slate-100" />
        <div class="w-3 h-3 rounded-sm bg-brand-100" />
        <div class="w-3 h-3 rounded-sm bg-brand-200" />
        <div class="w-3 h-3 rounded-sm bg-brand-400" />
        <div class="w-3 h-3 rounded-sm bg-brand-600" />
        <span>多</span>
      </div>
    </div>

    <!-- Most Active Day -->
    <div v-if="stats.mostActiveDay" class="px-4 pb-2 text-xs text-slate-500">
      最活跃的一天: {{ stats.mostActiveDay.date }} ({{ stats.mostActiveDay.count }} 篇)
    </div>

    <!-- Selected Date Documents -->
    <div v-if="selectedDate" class="border-t border-slate-200 bg-white">
      <div class="px-4 py-2 text-xs font-medium text-slate-600">
        {{ selectedDate }} 的文档 ({{ selectedDocuments.length }} 篇)
      </div>
      <div class="divide-y divide-slate-100 max-h-48 overflow-y-auto">
        <div
          v-for="doc in selectedDocuments"
          :key="doc.id"
          class="px-4 py-2 hover:bg-slate-50 cursor-pointer"
          @click="handleDocClick(doc)"
        >
          <div class="text-sm text-slate-700 truncate">{{ doc.title }}</div>
          <div class="text-xs text-slate-400 truncate">{{ doc.url }}</div>
        </div>
        <div v-if="selectedDocuments.length === 0" class="px-4 py-4 text-center text-slate-400 text-sm">
          当天无文档
        </div>
      </div>
    </div>
  </div>
</template>
