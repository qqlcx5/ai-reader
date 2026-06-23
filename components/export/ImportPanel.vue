<script lang="ts" setup>
/**
 * M7 — ZIP import panel.
 *
 * Drag-and-drop / click-to-upload area for .zip backup files.
 * Supports two merge strategies and shows a progress bar + result summary.
 */
import { ref, computed } from 'vue';
import { importFromZip, type ImportStrategy, type ImportResult } from '@/lib/export/importer';

const strategy = ref<ImportStrategy>('skip');
const dragging = ref(false);
const importing = ref(false);
const progress = ref(0);
const phase = ref('');
const result = ref<ImportResult | null>(null);
const error = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

const canImport = computed(() => !importing.value);

// ─── File handling ─────────────────────────────────────────────────────────

function onDragOver(e: DragEvent) {
  e.preventDefault();
  dragging.value = true;
}

function onDragLeave() {
  dragging.value = false;
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  dragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (file) startImport(file);
}

function onFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) startImport(file);
}

function openPicker() {
  fileInputRef.value?.click();
}

// ─── Import flow ─────────────────────────────────────────────────────────

async function startImport(file: File) {
  if (!file.name.endsWith('.zip')) {
    error.value = '请选择 .zip 格式的备份文件';
    return;
  }

  importing.value = true;
  progress.value = 0;
  phase.value = '';
  result.value = null;
  error.value = '';

  try {
    result.value = await importFromZip(file, strategy.value, (evt) => {
      progress.value = evt.progress;
      phase.value = evt.phase;
    });
  } catch (err_) {
    error.value = err_ instanceof Error ? err_.message : String(err_);
  } finally {
    importing.value = false;
    // Reset file input so the same file can be re-selected
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
}

function reset() {
  result.value = null;
  error.value = '';
  progress.value = 0;
  phase.value = '';
}
</script>

<template>
  <div class="import-panel">
    <header class="import-panel__head">
      <h3 class="import-panel__title">导入备份</h3>
      <p class="import-panel__hint">从本地 .zip 备份文件恢复数据</p>
    </header>

    <!-- Strategy radio -->
    <fieldset class="strategy-group" :disabled="importing">
      <legend class="strategy-group__legend">合并策略</legend>
      <label class="radio-label" :class="{ 'radio-label--active': strategy === 'skip' }">
        <input v-model="strategy" type="radio" value="skip" />
        <span>
          <strong>跳过重复项</strong>
          <small>保留本地数据，仅导入本地不存在的记录</small>
        </span>
      </label>
      <label class="radio-label" :class="{ 'radio-label--active': strategy === 'overwrite' }">
        <input v-model="strategy" type="radio" value="overwrite" />
        <span>
          <strong>覆盖合并</strong>
          <small>以导入数据为准，覆盖本地同 ID 的记录</small>
        </span>
      </label>
    </fieldset>

    <!-- Drop zone -->
    <div
      v-if="canImport && !result"
      class="drop-zone"
      :class="{ 'drop-zone--active': dragging }"
      role="button"
      tabindex="0"
      aria-label="拖入 ZIP 文件或点击选择"
      @click="openPicker"
      @keydown.enter="openPicker"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <svg class="drop-zone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      <p class="drop-zone__text">
        <span class="drop-zone__cta">点击选择</span>或将 .zip 文件拖入此区域
      </p>
      <input
        ref="fileInputRef"
        type="file"
        accept=".zip"
        class="drop-zone__input"
        tabindex="-1"
        @change="onFileSelect"
      />
    </div>

    <!-- Progress -->
    <div v-if="importing" class="progress-wrap">
      <div class="progress-bar-track">
        <div class="progress-bar-fill" :style="{ width: `${Math.round(progress * 100)}%` }" />
      </div>
      <p class="progress-label">{{ phase || '导入中…' }} ({{ Math.round(progress * 100) }}%)</p>
    </div>

    <!-- Result summary -->
    <div v-if="result && !error" class="result-card result-card--ok">
      <p class="result-card__title">导入完成</p>
      <ul class="result-card__list">
        <li>已导入：<strong>{{ result.imported }}</strong> 条记录</li>
        <li>已跳过：<strong>{{ result.skipped }}</strong> 条记录</li>
        <li v-if="result.errors.length">
          解析错误：<strong>{{ result.errors.length }}</strong> 个
        </li>
      </ul>
      <details v-if="result.errors.length" class="result-errors">
        <summary>查看错误详情</summary>
        <ul>
          <li v-for="(e, i) in result.errors" :key="i" class="result-error-item">{{ e }}</li>
        </ul>
      </details>
      <button class="btn-secondary" @click="reset">重新导入</button>
    </div>

    <!-- Error -->
    <div v-if="error" class="result-card result-card--err">
      <p class="result-card__title">导入失败</p>
      <p class="result-card__msg">{{ error }}</p>
      <button class="btn-secondary" @click="reset">重试</button>
    </div>
  </div>
</template>

<style scoped>
.import-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 20px);
  padding: var(--space-5, 20px);
  background: var(--card, #1e1e2e);
  border: 1px solid var(--border, rgba(255,255,255,.1));
  border-radius: var(--radius-lg, 12px);
}

.import-panel__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.import-panel__title {
  margin: 0;
  font-size: var(--fs-sm, 13px);
  font-weight: 700;
  color: var(--text, #e8e8f0);
}

.import-panel__hint {
  margin: 0;
  font-size: var(--fs-xs, 12px);
  color: var(--muted, #888);
}

/* ── Strategy radio ─────────────────────────────────────── */
.strategy-group {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.strategy-group__legend {
  font-size: var(--fs-xs, 12px);
  font-weight: 600;
  color: var(--muted, #888);
  margin-bottom: var(--space-2, 8px);
}

.radio-label {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border: 1px solid var(--border, rgba(255,255,255,.1));
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: border-color 120ms;
}

.radio-label--active {
  border-color: var(--primary, #7c3aed);
  background: var(--primary-soft, rgba(124,58,237,.1));
}

.radio-label input[type="radio"] {
  margin-top: 2px;
  accent-color: var(--primary, #7c3aed);
  flex-shrink: 0;
}

.radio-label strong {
  display: block;
  font-size: var(--fs-xs, 12px);
  color: var(--text, #e8e8f0);
  font-weight: 600;
}

.radio-label small {
  font-size: var(--fs-xs, 12px);
  color: var(--muted, #888);
}

/* ── Drop zone ──────────────────────────────────────────── */
.drop-zone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-7, 28px) var(--space-5, 20px);
  border: 2px dashed var(--border, rgba(255,255,255,.15));
  border-radius: var(--radius-lg, 12px);
  cursor: pointer;
  transition: border-color 150ms, background 150ms;
  text-align: center;
}

.drop-zone:hover,
.drop-zone--active {
  border-color: var(--primary, #7c3aed);
  background: var(--primary-soft, rgba(124,58,237,.06));
}

.drop-zone__icon {
  width: 40px;
  height: 40px;
  color: var(--muted, #888);
}

.drop-zone__text {
  margin: 0;
  font-size: var(--fs-xs, 12px);
  color: var(--muted, #888);
}

.drop-zone__cta {
  color: var(--primary, #7c3aed);
  font-weight: 600;
}

.drop-zone__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

/* ── Progress ───────────────────────────────────────────── */
.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.progress-bar-track {
  height: 6px;
  border-radius: 99px;
  background: var(--panel, rgba(255,255,255,.08));
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 99px;
  background: var(--primary, #7c3aed);
  transition: width 150ms ease-out;
}

.progress-label {
  margin: 0;
  font-size: var(--fs-xs, 12px);
  color: var(--muted, #888);
}

/* ── Result card ────────────────────────────────────────── */
.result-card {
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.result-card--ok {
  background: rgba(74, 222, 128, .08);
  border: 1px solid rgba(74, 222, 128, .3);
}

.result-card--err {
  background: rgba(248, 113, 113, .08);
  border: 1px solid rgba(248, 113, 113, .3);
}

.result-card__title {
  margin: 0;
  font-size: var(--fs-sm, 13px);
  font-weight: 700;
  color: var(--text, #e8e8f0);
}

.result-card__msg {
  margin: 0;
  font-size: var(--fs-xs, 12px);
  color: var(--red, #f87171);
}

.result-card__list {
  margin: 0;
  padding-left: 1.2em;
  font-size: var(--fs-xs, 12px);
  color: var(--text, #e8e8f0);
}

.result-errors {
  font-size: var(--fs-xs, 12px);
  color: var(--muted, #888);
}

.result-error-item {
  color: var(--red, #f87171);
  margin-top: 4px;
}

/* ── Secondary button ───────────────────────────────────── */
.btn-secondary {
  align-self: flex-start;
  padding: 6px 16px;
  border: 1px solid var(--border, rgba(255,255,255,.15));
  border-radius: var(--radius-md, 8px);
  background: transparent;
  color: var(--text, #e8e8f0);
  font-size: var(--fs-xs, 12px);
  cursor: pointer;
  transition: background 120ms;
}

.btn-secondary:hover { background: var(--panel, rgba(255,255,255,.06)); }
</style>
