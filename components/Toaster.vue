<script lang="ts" setup>
import { Toaster } from 'vue-sonner'
</script>

<template>
  <Toaster
    position="bottom-center"
    theme="system"
    :duration="3000"
    :visible-toasts="4"
    :close-button="true"
    :rich-colors="false"
    :expand="false"
    :gap="8"
  />
</template>
