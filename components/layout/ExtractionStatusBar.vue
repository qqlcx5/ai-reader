<script lang="ts" setup>
import { computed } from 'vue';
import { useContextStore } from '@/stores/context.store';

const ctx = useContextStore();

const engine = computed(() => ctx.currentContext?.engine ?? null);
const wordCount = computed(() => ctx.currentContext?.wordCount ?? 0);
const hasContext = computed(() => !!ctx.currentContext?.url);

const engineLabel = computed(() => {
  switch (engine.value) {
    case 'readability': return 'Readability';
    case 'defuddle':    return 'Defuddle';
    case 'fallback':    return 'Fallback';
    default:            return null;
  }
});

const engineColor = computed(() => {
  switch (engine.value) {
    case 'readability': return 'primary';
    case 'defuddle':    return 'green';
    case 'fallback':    return 'orange';
    default:            return 'muted';
  }
});

const dbLabel = 'IndexedDB';
</script>

<template>
  <div class="ext-bar" role="status" aria-live="polite">
    <div class="ext-bar__left">
      <!-- Engine tag -->
      <span
        v-if="engineLabel"
        class="ext-bar__tag"
        :data-color="engineColor"
        :title="`提取引擎：${engineLabel}`"
      >
        {{ engineLabel }}
      </span>

      <!-- DB status -->
      <span class="ext-bar__tag ext-bar__tag--db" title="数据存储">
        <span class="ext-bar__db-dot" aria-hidden="true"></span>
        {{ dbLabel }}
      </span>

      <!-- Word count -->
      <span v-if="wordCount > 0" class="ext-bar__count mono">
        {{ wordCount.toLocaleString() }} 字
      </span>
    </div>

    <div class="ext-bar__right">
      <!-- No Truncation badge -->
      <span
        v-if="hasContext"
        class="ext-bar__no-trunc"
        title="全文传入，无截断"
      >
        No Truncation
      </span>
    </div>
  </div>
</template>

<style scoped>
.ext-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  background: rgba(252, 252, 249, 0.6);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.ext-bar__left {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.ext-bar__right {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

/* Engine/DB tag pill */
.ext-bar__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-radius: var(--radius-pill);
  white-space: nowrap;
  color: var(--muted);
  background: var(--card);
  border: 1px solid var(--border);
}

.ext-bar__tag[data-color='primary'] {
  color: var(--primary);
  background: var(--primary-soft);
  border-color: #d2d6ff;
}

.ext-bar__tag[data-color='green'] {
  color: var(--green);
  background: var(--green-soft);
  border-color: #b6e8ce;
}

.ext-bar__tag[data-color='orange'] {
  color: var(--orange);
  background: var(--orange-soft);
  border-color: #f5d9a8;
}

.ext-bar__tag--db {
  color: var(--muted);
  background: var(--card);
}

.ext-bar__db-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--green);
}

.ext-bar__count {
  font-size: 10px;
  color: var(--muted);
  font-weight: 600;
  white-space: nowrap;
}

/* No Truncation badge — per spec */
.ext-bar__no-trunc {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-radius: var(--radius-pill);
  background: var(--green-soft);
  color: var(--green);
  white-space: nowrap;
}
</style>
