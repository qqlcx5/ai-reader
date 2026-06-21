<script lang="ts" setup>
import { computed } from 'vue';
import { useContextStore } from '@/stores/context.store';
import { useUiStore } from '@/stores/ui.store';
import IconButton from '@/components/shared/IconButton.vue';
import LoadingDots from '@/components/shared/LoadingDots.vue';

const ctx = useContextStore();
const ui = useUiStore();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'open-history'): void;
}>();

const title = computed(() => ctx.currentContext.title || '未提取页面1');
const wordCount = computed(() => {
  const text = ctx.currentContext.fullText || ctx.currentContext.excerpt || '';
  // CJK-aware rough word count
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = (text.match(/[A-Za-z]+/g) || []).length;
  return cjk + words;
});
const status = computed<'idle' | 'extracting' | 'ready' | 'error'>(() => {
  if (!ctx.currentContext.url) return 'idle';
  return 'ready';
});

const statusLabel = computed(() => {
  switch (status.value) {
    case 'extracting':
      return '提取中';
    case 'ready':
      return '已就绪';
    case 'error':
      return '提取失败';
    default:
      return '未提取';
  }
});

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
</script>

<template>
  <header class="ctx-bar surface-glass" :data-status="status">
    <div class="ctx-bar__main">
      <div class="ctx-bar__title-row">
        <span class="ctx-bar__title" :title="ctx.currentContext.url || '无 URL'">{{ title }}</span>
        <span class="ctx-bar__status" :data-status="status">
          <span v-if="status === 'extracting'" class="ctx-bar__dots"><LoadingDots size="sm" /></span>
          <span v-else class="dot" aria-hidden="true"></span>
          {{ statusLabel }}
        </span>
      </div>
      <div class="ctx-bar__meta">
        <span class="ctx-bar__count mono">{{ wordCount }} 字</span>
        <span v-if="ctx.currentContext.url" class="ctx-bar__url muted">
          {{ hostnameOf(ctx.currentContext.url) }}
        </span>
      </div>
    </div>
    <div class="ctx-bar__actions">
      <IconButton
        title="刷新提取当前 Tab"
        aria-label="刷新提取当前 Tab"
        variant="ghost"
        @click="emit('refresh')"
      >
        ↻
      </IconButton>
      <IconButton
        title="历史记录"
        aria-label="历史记录"
        variant="ghost"
        @click="emit('open-history')"
      >
        ☰
      </IconButton>
    </div>
  </header>
</template>

<style scoped>
.ctx-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 10px 12px;
  margin: 8px;
}

.ctx-bar__main {
  flex: 1;
  min-width: 0;
}

.ctx-bar__title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.ctx-bar__title {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.ctx-bar__status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.ctx-bar__status[data-status='ready'] {
  color: var(--green);
}

.ctx-bar__status[data-status='error'] {
  color: var(--red);
}

.ctx-bar__status[data-status='extracting'] {
  color: var(--orange);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.ctx-bar__dots {
  display: inline-flex;
  align-items: center;
  color: var(--orange);
}

.ctx-bar__meta {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
  margin-top: 2px;
  font-size: var(--fs-11);
}

.ctx-bar__count {
  color: var(--muted);
  font-weight: 600;
}

.ctx-bar__url {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ctx-bar__actions {
  display: flex;
  gap: 4px;
}
</style>
