<script lang="ts" setup>
/**
 * M4 — ModelCardFooter
 * 展示指标：TTFT | TPS | 费用 | ⚡ Cached
 * 等宽字体 font-mono text-[10px]
 * 操作按钮：【以此继续】/【中止】/【重试】
 */
import { computed } from 'vue'
import type { RequestMetrics } from '@/lib/providers/types'

const props = defineProps<{
  engineId: string
  metrics: RequestMetrics | null
  status: 'idle' | 'streaming' | 'done' | 'error' | 'aborted'
  providerName?: string
  cached?: boolean
}>()

const emit = defineEmits<{
  (e: 'continue', payload: { engineId: string }): void
  (e: 'abort', payload: { engineId: string }): void
  (e: 'retry', payload: { engineId: string }): void
}>()

const fmt = {
  ms: (n?: number | null) => (n == null ? '—' : `${Math.round(n)}ms`),
  tps: (n?: number | null) => (n == null ? '—' : `${n.toFixed(1)}/s`),
  cost: (n?: number | null) => (n == null ? '—' : `$${n.toFixed(4)}`),
}

const ttft = computed(() => fmt.ms(props.metrics?.ttft))
const tps = computed(() => fmt.tps(props.metrics?.tps))
const cost = computed(() => fmt.cost(props.metrics?.cost))
const isCached = computed(() => props.cached || props.metrics?.cached === true)
</script>

<template>
  <div class="mcf">
    <div class="mcf__metrics">
      <span class="mcf__chip" title="首字耗时">
        <span class="mcf__lbl">TTFT</span>
        <span class="mcf__val">{{ ttft }}</span>
      </span>
      <span class="mcf__chip" title="每秒 token 数">
        <span class="mcf__lbl">TPS</span>
        <span class="mcf__val">{{ tps }}</span>
      </span>
      <span class="mcf__chip" title="费用估算">
        <span class="mcf__lbl">费用</span>
        <span class="mcf__val">{{ cost }}</span>
      </span>
      <span v-if="isCached" class="mcf__cached" title="L3 缓存命中">⚡ Cached</span>
    </div>
    <div class="mcf__actions">
      <button
        v-if="status === 'streaming'"
        class="mcf__btn mcf__btn--abort"
        type="button"
        @click="emit('abort', { engineId })"
      >中止</button>
      <button
        v-if="status === 'error' || status === 'aborted'"
        class="mcf__btn"
        type="button"
        @click="emit('retry', { engineId })"
      >重试</button>
      <button
        v-if="status === 'done' || status === 'error' || status === 'aborted'"
        class="mcf__btn mcf__btn--primary"
        type="button"
        @click="emit('continue', { engineId })"
      >以此继续</button>
    </div>
  </div>
</template>

<style scoped>
.mcf {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border, #e6e2d8);
  background: var(--card, #faf9f5);
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}

.mcf__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.mcf__chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: var(--panel, #fff);
  border: 1px solid var(--border, #e6e2d8);
  border-radius: 6px;
  padding: 2px 6px;
}

.mcf__lbl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: var(--muted, #7a7568);
  font-family: var(--font-mono, monospace);
}

.mcf__val {
  font-size: 10px;
  font-weight: 700;
  color: var(--text, #2e2d2a);
  font-family: var(--font-mono, monospace);
}

.mcf__cached {
  font-size: 10px;
  font-weight: 700;
  color: var(--green, #248a52);
  font-family: var(--font-mono, monospace);
  padding: 2px 6px;
  background: var(--green-soft, #eefaf2);
  border-radius: 6px;
}

.mcf__actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.mcf__btn {
  font-size: 10px;
  font-weight: 700;
  padding: 4px 10px;
  border: 1px solid var(--border-strong, #cfc9bc);
  background: var(--panel, #fff);
  border-radius: 6px;
  color: var(--text, #2e2d2a);
  cursor: pointer;
  transition: all 100ms ease-out;
}

.mcf__btn:hover {
  background: var(--card, #faf9f5);
}

.mcf__btn--primary {
  background: var(--primary-soft, #f0f1fe);
  color: var(--primary, #5b60e5);
  border-color: #d2d6ff;
}

.mcf__btn--primary:hover {
  background: var(--primary, #5b60e5);
  color: white;
}

.mcf__btn--abort {
  background: var(--red-soft, #fdf4f4);
  color: var(--red, #d14343);
  border-color: var(--red-soft, #fdf4f4);
}

.mcf__btn--abort:hover {
  background: var(--red, #d14343);
  color: white;
}
</style>
