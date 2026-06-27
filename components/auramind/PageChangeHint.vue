<script lang="ts" setup>
import { useAppStore } from '@/stores/app.store'
import { useWorkspaceStore } from '@/stores/workspace.store'

const appStore = useAppStore()
const workspaceStore = useWorkspaceStore()

function switchToCurrentPage() {
  workspaceStore.setDocumentSource('current-page')
  appStore.showPageChangeHint = false
}
</script>

<template>
  <div
    v-if="appStore.showPageChangeHint && workspaceStore.documentSource === 'library'"
    class="h-9 shrink-0 bg-amber-50 border-b border-amber-200 flex items-center justify-center px-3 gap-2"
  >
    <span class="text-[12px] text-amber-700">浏览器当前页面已变化，</span>
    <button
      class="text-[12px] font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
      @click="switchToCurrentPage"
    >
      切换到当前页面
    </button>
  </div>
</template>
