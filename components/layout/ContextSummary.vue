<script lang="ts" setup>
import { computed } from 'vue';
import { useContextStore } from '@/stores/context.store';
import { useUiStore } from '@/stores/ui.store';
import IconButton from '@/components/shared/IconButton.vue';
import LoadingDots from '@/components/shared/LoadingDots.vue';

const ctx = useContextStore();
const ui = useUiStore();

const wordCount = computed(() => {
  const text = ctx.currentContext?.fullText || ctx.currentContext?.excerpt || '';
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = (text.match(/[A-Za-z]+/g) || []).length;
  return cjk + words;
});

const host = computed(() => {
  try {
    return ctx.currentContext?.url ? new URL(ctx.currentContext.url).hostname : '';
  } catch {
    return '';
  }
});


const hasContext = computed(() => Boolean(ctx.currentContext?.url));
</script>

<template>
  <section class="ctx-summary" :data-state="hasContext ? 'ready' : 'idle'">
    <div class="ctx-summary__head">
      <div class="ctx-summary__title-row">
        <span class="ctx-summary__icon" aria-hidden="true">📄</span>
        <span class="ctx-summary__title">{{ ctx.currentContext?.title || '未提取页面' }}</span>
      </div>
      <span v-if="hasContext" class="ctx-summary__badge">
        <span class="dot" aria-hidden="true"></span>
        已就绪
      </span>
    </div>
    <div v-if="hasContext" class="ctx-summary__meta">
      <div class="ctx-summary__row">
        <span class="label">字数</span>
        <span class="value mono">{{ wordCount }}</span>
      </div>
      <div class="ctx-summary__row">
        <span class="label">域名</span>
        <span class="value muted">{{ host }}</span>
      </div>
      <div class="ctx-summary__row">
        <span class="label">提取模式</span>
        <span class="value">{{ ctx.currentContext?.mode || ctx.mode || 'full' }}</span>
      </div>
    </div>
    <div v-else class="ctx-summary__empty muted">
      <LoadingDots /> 等待 Side Panel 提取…
    </div>
  </section>
</template>

<style scoped>
.ctx-summary {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--card);
}

.ctx-summary__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.ctx-summary__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.ctx-summary__icon {
  font-size: 12px;
  flex-shrink: 0;
}

.ctx-summary__title {
  font-size: var(--fs-xs);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.ctx-summary__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--green);
  background: var(--green-soft);
  padding: 2px 6px;
  border-radius: var(--radius-pill);
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.ctx-summary__meta {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ctx-summary__row {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-11);
}

.ctx-summary__row .label {
  color: var(--muted);
}

.ctx-summary__row .value {
  color: var(--text);
  font-weight: 600;
}

.ctx-summary__empty {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-11);
}
</style>
