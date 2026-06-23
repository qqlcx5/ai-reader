<script lang="ts" setup>
/**
 * M7 — Export progress modal.
 *
 * Displays a progress bar (purple fill, 150 ms transition) while the ZIP
 * worker is running, then shows a success toast on completion.
 */
import { computed } from 'vue';

const props = defineProps<{
  /** Whether the modal is visible. */
  visible: boolean;
  /** 0–1 fraction of work completed. */
  progress: number;
  /** Human-readable label for the currently processed file. */
  currentFile?: string;
  /** Set to true once export is finished. */
  done?: boolean;
  /** Error message if the export failed. */
  error?: string;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const pct = computed(() => Math.round(props.progress * 100));
const statusLabel = computed(() => {
  if (props.error) return '导出失败';
  if (props.done) return '导出成功，已下载到本地 ✓';
  if (props.currentFile) return `正在处理 ${props.currentFile}`;
  return '准备中…';
});
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="ep-overlay" role="dialog" aria-modal="true" aria-label="导出进度">
      <div class="ep-modal">
        <h3 class="ep-title">
          <span v-if="!done && !error">全量导出</span>
          <span v-else-if="done" class="ep-title--done">导出完成</span>
          <span v-else class="ep-title--error">导出失败</span>
        </h3>

        <!-- Progress bar -->
        <div class="ep-bar-track" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100">
          <div
            class="ep-bar-fill"
            :class="{ 'ep-bar-fill--done': done, 'ep-bar-fill--error': error }"
            :style="{ width: `${pct}%` }"
          />
        </div>

        <p class="ep-status" :class="{ 'ep-status--error': error, 'ep-status--done': done }">
          {{ statusLabel }}
        </p>
        <p class="ep-pct">{{ pct }}%</p>

        <!-- Close button: only shown after done/error -->
        <button v-if="done || error" class="ep-btn" @click="$emit('close')">
          {{ done ? '关闭' : '关闭' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ep-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.ep-modal {
  background: var(--card, #faf9f5);
  border: 1px solid var(--border, #e6e2d8);
  border-radius: var(--radius-xl, 16px);
  padding: var(--space-7, 28px) var(--space-8, 32px);
  min-width: 340px;
  max-width: 460px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
  box-shadow: 0 20px 60px rgba(0,0,0,.4);
}

.ep-title {
  margin: 0;
  font-size: var(--fs-base, 15px);
  font-weight: 700;
  color: var(--text, #e8e8f0);
}

.ep-title--done  { color: var(--green,  #4ade80); }
.ep-title--error { color: var(--red,    #f87171); }

.ep-bar-track {
  height: 8px;
  border-radius: 99px;
  background: var(--panel, #ffffff);
  overflow: hidden;
}

.ep-bar-fill {
  height: 100%;
  border-radius: 99px;
  background: var(--primary, #5b60e5);
  transition: width 150ms ease-out;
}

.ep-bar-fill--done  { background: var(--green, #4ade80); }
.ep-bar-fill--error { background: var(--red,   #f87171); }

.ep-status {
  margin: 0;
  font-size: var(--fs-xs, 12px);
  color: var(--muted, #888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ep-status--done  { color: var(--green, #4ade80); }
.ep-status--error { color: var(--red,   #f87171); }

.ep-pct {
  margin: 0;
  font-size: var(--fs-sm, 13px);
  font-weight: 700;
  color: var(--primary, #5b60e5);
  text-align: right;
}

.ep-btn {
  align-self: flex-end;
  padding: 8px 20px;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: var(--primary, #5b60e5);
  color: #fff;
  font-size: var(--fs-sm, 13px);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 120ms;
}

.ep-btn:hover { opacity: 0.85; }
</style>

