<script lang="ts" setup>
/**
 * M4 — ModelRouteChips
 * rounded-full 药丸 chips，横向换行，复选框 + 模型名 + 厂商色点。
 * 最多选 4 个 Provider。
 */
import { computed } from 'vue'
import { providerColor } from '@/stores/arena.store'

export interface ProviderOption {
  engineId: string
  name: string
  model?: string
  color?: string
}

const props = defineProps<{
  providers: ProviderOption[]
  selected: string[]
  disabled?: boolean
  /** 最大可选数量（默认 4） */
  maxSelect?: number
}>()

const emit = defineEmits<{
  (e: 'update:selected', value: string[]): void
}>()

const max = props.maxSelect ?? 4

function toggle(engineId: string): void {
  if (props.disabled) return
  const idx = props.selected.indexOf(engineId)
  if (idx === -1) {
    if (props.selected.length >= max) return
    emit('update:selected', [...props.selected, engineId])
  } else {
    emit('update:selected', props.selected.filter((id) => id !== engineId))
  }
}

function isSelected(engineId: string): boolean {
  return props.selected.includes(engineId)
}

function chipColor(p: ProviderOption): string {
  return p.color ?? providerColor(p.engineId)
}
</script>

<template>
  <div class="chips">
    <button
      v-for="p in providers"
      :key="p.engineId"
      class="chip"
      :class="{
        'chip--selected': isSelected(p.engineId),
        'chip--disabled': disabled || (!isSelected(p.engineId) && selected.length >= max),
      }"
      type="button"
      :title="`${p.name}${p.model ? ' · ' + p.model : ''}`"
      @click="toggle(p.engineId)"
    >
      <span class="chip__dot" :style="{ background: chipColor(p) }"></span>
      <span class="chip__name">{{ p.name }}</span>
      <span v-if="isSelected(p.engineId)" class="chip__check">✓</span>
    </button>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 6px 12px 2px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 9999px;
  border: 1px solid var(--border, #e6e2d8);
  background: var(--panel, #ffffff);
  font-size: 10px;
  font-weight: 600;
  color: var(--muted, #7a7568);
  cursor: pointer;
  transition: all 100ms ease-out;
  user-select: none;
  white-space: nowrap;
}

.chip:hover:not(.chip--disabled) {
  border-color: var(--primary, #5b60e5);
  color: var(--primary, #5b60e5);
}

.chip--selected {
  background: var(--primary-soft, #f0f1fe);
  border-color: #d2d6ff;
  color: var(--primary, #5b60e5);
  font-weight: 700;
}

.chip--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.chip__name {
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip__check {
  font-size: 8px;
  color: var(--primary, #5b60e5);
}
</style>
