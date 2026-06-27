<script lang="ts" setup>
import { SwitchRoot, SwitchThumb } from 'reka-ui'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <SwitchRoot
    :checked="modelValue"
    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors bg-zinc-200 data-[state=checked]:bg-brand outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
    @update:checked="emit('update:modelValue', $event)"
  >
    <SwitchThumb
      class="block size-4 rounded-full bg-white border border-zinc-300 transition-transform translate-x-[-4px] data-[state=checked]:translate-x-[12px] shadow-sm"
    />
  </SwitchRoot>
</template>
