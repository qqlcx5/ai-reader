<script lang="ts" setup>
import {
  SelectRoot, SelectTrigger, SelectValue, SelectContent,
  SelectItem, SelectItemText, SelectPortal, SelectIcon, SelectViewport,
} from 'reka-ui'
import { ChevronDown } from '@lucide/vue'

defineProps<{
  modelValue: string
  options: { value: string; label: string }[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <SelectRoot :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <SelectTrigger
      class="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg pl-2.5 pr-2 py-2 outline-none inline-flex items-center justify-between cursor-pointer focus:border-brand transition"
    >
      <SelectValue :placeholder="placeholder" />
      <SelectIcon>
        <ChevronDown class="w-3.5 h-3.5 text-zinc-500" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        class="bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden z-50"
        :side-offset="4"
        position="popper"
      >
        <SelectViewport class="p-1">
          <SelectItem
            v-for="opt in options"
            :key="opt.value"
            :value="opt.value"
            class="text-xs px-2.5 py-2 rounded-md outline-none cursor-pointer hover:bg-zinc-100 data-[highlighted]:bg-zinc-100 data-[state=checked]:bg-indigo-50 data-[state=checked]:text-brand"
          >
            <SelectItemText>{{ opt.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
