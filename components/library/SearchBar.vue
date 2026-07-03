<script lang="ts" setup>
import { ref, watch } from 'vue'
import { Search } from '@lucide/vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [query: string]
}>()

const query = ref(props.modelValue)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.modelValue,
  (val) => {
    query.value = val
  },
)

function onInput(value: string) {
  query.value = value
  emit('update:modelValue', value)

  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    emit('search', value)
  }, 300)
}
</script>

<template>
  <div
    class="h-10 bg-white border border-zinc-200 rounded-xl flex items-center px-3 shadow-sm focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 transition-all"
  >
    <Search class="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
    <input
      class="flex-1 outline-none bg-transparent text-[13px] placeholder:text-zinc-400"
      placeholder="搜索知识库、网页、对话..."
      :value="query"
      @input="onInput(($event.target as HTMLInputElement).value)"
    />
    <kbd class="text-[10px] px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-zinc-500 font-mono">&#8984;K</kbd>
  </div>
</template>
