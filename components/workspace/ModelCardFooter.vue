<script lang="ts" setup>
/**
 * M4 — ModelCardFooter
 * 数据透视底栏：耗时 | TTFT | Tokens/s | 消耗量预估
 * + 「以此继续 / 中止 / 重试」操作
 */
import { computed } from 'vue';
import type { RequestMetrics } from '@/modules/provider';

const props = defineProps<{
  metrics: RequestMetrics | null;
  status: 'pending' | 'streaming' | 'done' | 'error' | 'aborted';
  providerName: string;
}>();

const emit = defineEmits<{
  (e: 'continue', payload: { providerId: string }): void;
  (e: 'abort', payload: { providerId: string }): void;
  (e: 'retry', payload: { providerId: string }): void;
}>();

const fmtMs = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n)}ms`);
const fmtPerSec = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(1)}/s`);
const fmtCost = (n: number | null | undefined) => (n == null ? '—' : `$${n.toFixed(4)}`);
const fmtToken = (n: number | null | undefined) => (n == null ? '—' : `${n} tok`);

const totalLatency = computed(() => fmtMs(props.metrics?.totalLatency));
const ttft = computed(() => {
  const m = props.metrics;
  if (!m || m.firstTokenTime == null || m.startTime == null) return '—';
  return fmtMs(m.firstTokenTime - m.startTime);
});
const tps = computed(() => fmtPerSec(props.metrics?.tokensPerSecond));
const cost = computed(() => fmtCost(props.metrics?.estimatedCost));
const tokens = computed(() => fmtToken(props.metrics?.endTime ? null : null));

const statusLabel = computed(() => {
  switch (props.status) {
    case 'pending':
      return '排队中';
    case 'streaming':
      return '生成中';
    case 'done':
      return '已完成';
    case 'error':
      return '出错';
    case 'aborted':
      return '已中止';
    default:
      return '';
  }
});

const statusClass = computed(() => `footer__status--${props.status}`);

function onContinue() {
  emit('continue', { providerId: props.metrics?.providerId ?? '' });
}
function onAbort() {
  emit('abort', { providerId: props.metrics?.providerId ?? '' });
}
function onRetry() {
  emit('retry', { providerId: props.metrics?.providerId ?? '' });
}
</script>

<template>
  <div class="footer">
    <div class="footer__metrics">
      <span class="footer__chip" :title="'总耗时'">
        <span class="footer__label muted">耗时</span>
        <span class="footer__value mono">{{ totalLatency }}</span>
      </span>
      <span class="footer__chip" :title="'首字耗时'">
        <span class="footer__label muted">TTFT</span>
        <span class="footer__value mono">{{ ttft }}</span>
      </span>
      <span class="footer__chip" :title="'每秒 token 数'">
        <span class="footer__label muted">TPS</span>
        <span class="footer__value mono">{{ tps }}</span>
      </span>
      <span class="footer__chip" :title="'消耗量估算'">
        <span class="footer__label muted">费用</span>
        <span class="footer__value mono">{{ cost }}</span>
      </span>
      <span class="footer__status" :class="statusClass">{{ statusLabel }}</span>
    </div>
    <div class="footer__actions">
      <button
        v-if="status === 'streaming'"
        class="footer__btn footer__btn--abort"
        type="button"
        @click="onAbort"
      >中止</button>
      <button
        v-if="status === 'error' || status === 'aborted'"
        class="footer__btn"
        type="button"
        @click="onRetry"
      >重试</button>
      <button
        v-if="status === 'done' || status === 'error' || status === 'aborted'"
        class="footer__btn footer__btn--primary"
        type="button"
        @click="onContinue"
      >以此继续</button>
    </div>
  </div>
</template>

<style scoped>
.footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  background: var(--card);
  border-bottom-left-radius: var(--radius-xl);
  border-bottom-right-radius: var(--radius-xl);
}

.footer__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  font-size: var(--fs-10);
}

.footer__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 2px 6px;
}

.footer__label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
}

.footer__value {
  font-size: var(--fs-11);
  font-weight: 700;
  color: var(--text);
}

.footer__status {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  background: var(--card);
  color: var(--muted);
  border: 1px solid var(--border);
}

.footer__status--streaming {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary-soft);
}

.footer__status--done {
  background: var(--green-soft);
  color: var(--green);
  border-color: var(--green-soft);
}

.footer__status--error {
  background: var(--red-soft);
  color: var(--red);
  border-color: var(--red-soft);
}

.footer__status--aborted {
  background: var(--orange-soft);
  color: var(--orange);
  border-color: var(--orange-soft);
}

.footer__actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.footer__btn {
  font-size: var(--fs-10);
  font-weight: 700;
  padding: 4px 10px;
  border: 1px solid var(--border-strong);
  background: var(--panel);
  border-radius: var(--radius-md);
  color: var(--text);
  cursor: pointer;
  transition: all 100ms ease-out;
}

.footer__btn:hover {
  background: var(--card);
}

.footer__btn--primary {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: #d2d6ff;
}

.footer__btn--primary:hover {
  background: var(--primary);
  color: white;
}

.footer__btn--abort {
  background: var(--red-soft);
  color: var(--red);
  border-color: var(--red-soft);
}
</style>
