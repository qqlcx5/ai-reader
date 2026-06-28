<script lang="ts" setup>
import { TabsList } from 'reka-ui'
</script>

<template>
  <TabsList v-bind="$attrs">
    <slot />
  </TabsList>
</template>
