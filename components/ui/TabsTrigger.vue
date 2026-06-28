<script lang="ts" setup>
import { TabsTrigger } from 'reka-ui'

defineProps<{
  value: string | number
}>()

defineOptions({ inheritAttrs: false })
</script>

<template>
  <TabsTrigger v-bind="$attrs" :value="value">
    <slot />
  </TabsTrigger>
</template>
