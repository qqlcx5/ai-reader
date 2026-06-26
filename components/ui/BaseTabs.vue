<script setup lang="ts">
import {
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from 'reka-ui'

defineProps<{
  tabs: { id: string; label: string; icon?: string }[]
}>()

const modelValue = defineModel<string>('modelValue', { default: '' })
</script>

<template>
  <TabsRoot :model-value="modelValue" @update:model-value="modelValue = $event as string">
    <TabsList
      class="flex border-b border-slate-200 dark:border-slate-700 text-sm"
      aria-label="Tab navigation"
    >
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.id"
        :value="tab.id"
        :class="[
          'flex-1 py-2.5 px-4 text-center font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20',
          'data-[state=active]:border-brand-500 data-[state=active]:text-brand-500',
          'data-[state=inactive]:border-transparent data-[state=inactive]:text-slate-400 hover:data-[state=inactive]:text-slate-600 dark:hover:data-[state=inactive]:text-slate-300',
        ]"
      >
        <span v-if="tab.icon" class="mr-1.5">{{ tab.icon }}</span>
        {{ tab.label }}
      </TabsTrigger>
    </TabsList>

    <TabsContent
      v-for="tab in tabs"
      :key="tab.id"
      :value="tab.id"
      class="mt-4 focus:outline-none"
    >
      <slot :name="tab.id" />
    </TabsContent>
  </TabsRoot>
</template>
