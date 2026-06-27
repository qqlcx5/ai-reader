<script lang="ts" setup>
import { Settings } from '@lucide/vue'

defineProps<{
  name: string
  endpoint: string
  isDefault?: boolean
  model?: boolean
  enabled?: boolean
  iconColor?: string
  iconBg?: string
}>()

const emit = defineEmits<{
  toggle: [value: boolean]
  settings: []
}>()
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 p-3 shadow-sm relative overflow-hidden group">
    <div v-if="isDefault" class="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400" />

    <div class="flex items-center justify-between" :class="{ 'pl-2': isDefault }">
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-lg border flex items-center justify-center"
          :class="[iconBg || 'bg-zinc-100 border-zinc-200 text-zinc-600']"
        >
          <slot name="icon" />
        </div>

        <div>
          <div class="text-[13px] font-medium flex items-center gap-1.5">
            {{ name }}
            <span v-if="isDefault" class="text-[9px] px-1 bg-emerald-100 text-emerald-600 rounded font-semibold">默认</span>
          </div>
          <div class="text-[11px] text-zinc-400 font-mono">{{ endpoint }}</div>
        </div>
      </div>

      <RekaButton
        v-if="!model"
        variant="ghost"
        size="sm"
        class="!p-1.5"
        @click="emit('settings')"
      >
        <Settings class="w-3.5 h-3.5" />
      </RekaButton>

      <slot v-else name="toggle" />
    </div>
  </div>
</template>
