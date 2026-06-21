<script lang="ts" setup>
/**
 * M4 — ModelCard
 * 单个模型回复卡片：header (色点 + 模型名 + 状态) + body (StreamingText) + footer (ModelCardFooter)
 */
import { ref, watch } from 'vue';
import StreamingText from './StreamingText.vue';
import ModelCardFooter from './ModelCardFooter.vue';
import type { ModelResponseStatus } from '@/lib/workspace';
import type { RequestMetrics } from '@/modules/provider';

const props = defineProps<{
  response: ModelResponseStatus;
  providerName: string;
  providerColor?: string;
}>();

const emit = defineEmits<{
  (e: 'continue', payload: { providerId: string }): void;
  (e: 'abort', payload: { providerId: string }): void;
  (e: 'retry', payload: { providerId: string }): void;
}>();

const textRef = ref<InstanceType<typeof StreamingText> | null>(null);

// 当 props.response.content 变化时把增量同步给 StreamingText
watch(
  () => props.response.content,
  (next, prev) => {
    if (!textRef.value) return;
    if (typeof next !== 'string') return;
    if (typeof prev !== 'string') {
      textRef.value.setContent(next);
      return;
    }
    if (next.length > prev.length && next.startsWith(prev)) {
      textRef.value.append(next.slice(prev.length));
    } else if (next !== prev) {
      textRef.value.setContent(next);
    }
  },
  { immediate: true },
);

const statusText: Record<ModelResponseStatus['status'], string> = {
  pending: '排队中',
  streaming: '生成中',
  done: '已完成',
  error: '出错',
  aborted: '已中止',
};

const metrics: RequestMetrics | null = props.response.metrics;
</script>

<template>
  <div class="model-card surface">
    <header class="model-card__head">
      <span class="model-card__dot" :style="{ background: providerColor || 'var(--primary)' }"></span>
      <span class="model-card__name">{{ providerName }}</span>
      <span class="model-card__status" :class="`model-card__status--${response.status}`">
        {{ statusText[response.status] }}
      </span>
    </header>
    <div class="model-card__body">
      <div v-if="response.status === 'pending'" class="model-card__placeholder muted">
        等待 LLM 响应…
      </div>
      <div v-else-if="response.error" class="model-card__error">
        <strong>出错了：</strong>{{ response.error.message }}
      </div>
      <StreamingText
        v-else
        ref="textRef"
        :content="response.content"
        text-class="model-card__text"
      />
    </div>
    <ModelCardFooter
      :metrics="response.metrics"
      :status="response.status"
      :provider-name="providerName"
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
  border-radius: var(--radius-xl);
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  min-height: 200px;
}

.model-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--card);
}

.model-card__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

.model-card__name {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text);
}

.model-card__status {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  background: var(--panel);
  color: var(--muted);
  border: 1px solid var(--border);
}

.model-card__status--streaming {
  background: var(--primary-soft);
  color: var(--primary);
}

.model-card__status--done {
  background: var(--green-soft);
  color: var(--green);
}

.model-card__status--error {
  background: var(--red-soft);
  color: var(--red);
}

.model-card__status--aborted {
  background: var(--orange-soft);
  color: var(--orange);
}

.model-card__body {
  flex: 1;
  padding: 12px;
  min-height: 120px;
  max-height: 360px;
  overflow-y: auto;
}

.model-card__placeholder {
  font-size: var(--fs-xs);
  font-style: italic;
}

.model-card__error {
  font-size: var(--fs-xs);
  color: var(--red);
  line-height: 1.6;
}

.model-card__text {
  font-size: var(--fs-xs);
}
</style>
