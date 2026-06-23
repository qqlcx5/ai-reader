<script lang="ts" setup>
/**
 * M4 — ModelCard
 * 白色 + border-obsidian-border + rounded-2xl + shadow-sm
 * Header: 厂商色点 + 模型名 + 状态 badge
 * Body: StreamingText（min-h 140px）
 * Footer: ModelCardFooter
 */
import { ref, watch } from 'vue'
import StreamingText from './StreamingText.vue'
import ModelCardFooter from './ModelCardFooter.vue'
import type { RequestMetrics, ProviderError } from '@/lib/providers/types'
import type { SlotStatus } from '@/stores/arena.store'

const props = defineProps<{
  engineId: string
  name: string
  color?: string
  status: SlotStatus
  content: string
  metrics: RequestMetrics | null
  error: ProviderError | null
  cached?: boolean
}>()

const emit = defineEmits<{
  (e: 'continue', payload: { engineId: string }): void
  (e: 'abort', payload: { engineId: string }): void
  (e: 'retry', payload: { engineId: string }): void
}>()

const streamRef = ref<InstanceType<typeof StreamingText> | null>(null)

// 将 content 变化增量推给 StreamingText
watch(
  () => props.content,
  (next, prev) => {
    if (!streamRef.value) return
    if (typeof next !== 'string') return
    if (!prev) {
      streamRef.value.setContent(next)
    } else if (next.length > prev.length && next.startsWith(prev)) {
      streamRef.value.append(next.slice(prev.length))
    } else if (next !== prev) {
      streamRef.value.setContent(next)
    }
  },
  { immediate: true },
)

const STATUS_LABEL: Record<SlotStatus, string> = {
  idle: '等待中',
  streaming: '生成中',
  done: '已完成',
  error: '出错',
  aborted: '已中止',
}
</script>

<template>
  <div class="model-card">
    <!-- Header -->
    <header class="model-card__head">
      <span class="model-card__dot" :style="{ background: color || 'var(--primary, #5b60e5)' }"></span>
      <span class="model-card__name">{{ name }}</span>
      <span class="model-card__badge" :class="`model-card__badge--${status}`">
        {{ STATUS_LABEL[status] }}
      </span>
    </header>

    <!-- Body -->
    <div class="model-card__body">
      <div v-if="status === 'idle'" class="model-card__placeholder">等待 LLM 响应…</div>
      <div v-else-if="error && status === 'error'" class="model-card__error">
        <strong>出错：</strong>{{ error.message }}
        <div v-if="error.code" class="model-card__error-code">Code: {{ error.code }}</div>
      </div>
      <StreamingText
        v-else
        ref="streamRef"
        :content="content"
        :done="status === 'done'"
      />
    </div>

    <!-- Footer -->
    <ModelCardFooter
      :engine-id="engineId"
      :metrics="metrics"
      :status="status"
      :provider-name="name"
      :cached="cached"
      @continue="(p) => emit('continue', p)"
      @abort="(p) => emit('abort', p)"
      @retry="(p) => emit('retry', p)"
    />
  </div>
</template>

<style scoped>
.model-card {
  display: flex;
  flex-direction: column;
  background: var(--panel, #ffffff);
  border: 1px solid var(--border, #e6e2d8);
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  min-height: 200px;
}

.model-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border, #e6e2d8);
  background: var(--card, #faf9f5);
}

.model-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.model-card__name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text, #2e2d2a);
}

.model-card__badge {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2px 7px;
  border-radius: 9999px;
  background: var(--panel, #fff);
  color: var(--muted, #7a7568);
  border: 1px solid var(--border, #e6e2d8);
}

.model-card__badge--streaming {
  background: var(--primary-soft, #f0f1fe);
  color: var(--primary, #5b60e5);
  border-color: #d2d6ff;
}

.model-card__badge--done {
  background: var(--green-soft, #eefaf2);
  color: var(--green, #248a52);
  border-color: #b6e8cc;
}

.model-card__badge--error {
  background: var(--red-soft, #fdf4f4);
  color: var(--red, #d14343);
  border-color: #f5c2c2;
}

.model-card__badge--aborted {
  background: var(--orange-soft, #fff9ee);
  color: var(--orange, #ca7a15);
  border-color: #fce2a8;
}

.model-card__body {
  flex: 1;
  padding: 14px;
  min-height: 140px;
  max-height: 480px;
  overflow-y: auto;
}

.model-card__placeholder {
  font-size: 12px;
  color: var(--muted-light, #a39d8f);
  font-style: italic;
}

.model-card__error {
  font-size: 12px;
  color: var(--red, #d14343);
  line-height: 1.6;
}

.model-card__error-code {
  margin-top: 4px;
  font-size: 10px;
  font-family: var(--font-mono, monospace);
  color: var(--muted, #7a7568);
}
</style>
