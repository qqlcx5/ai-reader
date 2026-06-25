<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import { aggregateTimeline } from '@/core/timeline/timeline.service';
import type { TimelineBucket, CapturedDocument } from '@/shared/types';
import { getDocument } from '@/db/document-repository';

const emit = defineEmits<{
  (e: 'open-doc', doc: CapturedDocument): void;
}>();

const buckets = ref<TimelineBucket[]>([]);
const selectedDate = ref<string | null>(null);
const dayDocs = ref<CapturedDocument[]>([]);
const total = ref(0);
const streak = ref(0);

const maxCount = computed(() => {
  return Math.max(1, ...buckets.value.map((b: TimelineBucket) => b.count));
});

const heatmapColor = (count: number): string => {
  if (count === 0) return 'var(--color-bg-secondary)';
  const ratio = count / maxCount.value;
  if (ratio > 0.75) return '#1e40af';
  if (ratio > 0.5) return '#3b82f6';
  if (ratio > 0.25) return '#60a5fa';
  return '#93c5fd';
};

onMounted(async () => {
  const result = await aggregateTimeline();
  buckets.value = result.buckets;
  total.value = result.total;
  streak.value = result.streak;
});

async function selectDate(date: string): Promise<void> {
  selectedDate.value = date;
  const bucket = buckets.value.find((b: TimelineBucket) => b.date === date);
  if (bucket) {
    const docs = await Promise.all(
      bucket.documentIds.map((id: string) => getDocument(id))
    );
    dayDocs.value = docs.filter((d: CapturedDocument | undefined): d is CapturedDocument => !!d);
  } else {
    dayDocs.value = [];
  }
}

async function openDoc(doc: CapturedDocument): Promise<void> {
  emit('open-doc', doc);
  selectedDate.value = null;
}
</script>

<template>
  <div class="timeline-page">
    <div class="stats">
      <div class="stat">
        <div class="stat-value">{{ total }}</div>
        <div class="stat-label">总捕获</div>
      </div>
      <div class="stat">
        <div class="stat-value">{{ streak }}</div>
        <div class="stat-label">连续天数</div>
      </div>
    </div>

    <div class="heatmap">
      <div class="grid">
        <div
          v-for="b in buckets"
          :key="b.date"
          class="cell"
          :style="{ background: heatmapColor(b.count) }"
          :title="`${b.date}: ${b.count} 篇`"
          @click="selectDate(b.date)"
        ></div>
      </div>
    </div>

    <div v-if="selectedDate" class="day-detail">
      <div class="day-header">
        <span>{{ selectedDate }}（{{ dayDocs.length }} 篇）</span>
        <button class="close-btn" @click="selectedDate = null">×</button>
      </div>
      <div class="day-docs">
        <div
          v-for="doc in dayDocs"
          :key="doc.id"
          class="day-doc"
          @click="openDoc(doc)"
        >
          <div class="day-doc-title">{{ doc.title }}</div>
          <div class="day-doc-time">{{ dayjs(doc.createdAt).format('HH:mm') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  gap: 16px;
}

.stats {
  display: flex;
  gap: 12px;
}
.stat {
  flex: 1;
  padding: 12px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  text-align: center;
}
.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-primary);
}
.stat-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.heatmap {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 12px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14px, 1fr));
  gap: 3px;
}

.cell {
  aspect-ratio: 1;
  border-radius: 2px;
  cursor: pointer;
  transition: transform 0.1s;
}
.cell:hover {
  transform: scale(1.2);
  outline: 1px solid var(--color-text);
}

.day-detail {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
  font-weight: 500;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  color: var(--color-text-secondary);
  padding: 0 4px;
}

.day-docs {
  max-height: 200px;
  overflow-y: auto;
}

.day-doc {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.15s;
}
.day-doc:last-child {
  border-bottom: none;
}
.day-doc:hover {
  background: var(--color-bg);
}

.day-doc-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-doc-time {
  font-size: 11px;
  color: var(--color-text-secondary);
}
</style>
