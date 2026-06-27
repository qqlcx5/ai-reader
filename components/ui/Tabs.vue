<script lang="ts" setup>
import {
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from 'reka-ui'

export type { TabsRootProps } from 'reka-ui'
</script>

<template>
  <TabsRoot
    v-bind="$attrs"
    class="flex flex-col flex-1 min-h-0"
  >
    <slot />
  </TabsRoot>
</template>
