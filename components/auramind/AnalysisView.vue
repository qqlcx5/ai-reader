<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import {
  ArrowUp, RefreshCw, Trash2,
} from '@lucide/vue'
import AnalysisConfigCenter from '@/components/auramind/AnalysisConfigCenter.vue'
import DocumentPickerDialog from '@/components/auramind/DocumentPickerDialog.vue'
import BatchAnalysisDialog from '@/components/auramind/BatchAnalysisDialog.vue'
import UDropdownMenu from '@/components/ui/UDropdownMenu.vue'
import AnalysisQueueHeader from '@/components/auramind/analysis/AnalysisQueueHeader.vue'
import AnalysisJobFilters from '@/components/auramind/analysis/AnalysisJobFilters.vue'
import AnalysisJobList from '@/components/auramind/analysis/AnalysisJobList.vue'
import { useAiJobPanel } from '@/components/auramind/analysis/useAiJobPanel'
import { useAnalysisPolling } from '@/components/auramind/analysis/useAnalysisPolling'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useAppStore } from '@/stores/app.store'
import { useModelStore } from '@/stores/model.store'
import { usePromptTemplateStore } from '@/stores/prompt-template.store'
import type { AiJobPriority } from '@/types/ai-job'

const aiJobStore = useAiJobStore()
const appStore = useAppStore()
const modelStore = useModelStore()
const promptStore = usePromptTemplateStore()

const { jobs } = storeToRefs(aiJobStore)
const {
  filter,
  filteredJobs,
  hasActiveFilters,
  selectedIds,
  selectMode,
  selectedCount,
  setFilter,
  resetFilter,
  toggleSelect,
  selectAll,
  selectNone,
  toggleSelectMode,
} = useAiJobPanel(jobs)

useAnalysisPolling(aiJobStore)

onMounted(async () => {
  await aiJobStore.loadJobs()
  await modelStore.loadModels()
  await promptStore.initTemplates()
  if (aiJobStore.stats.pending > 0 && !aiJobStore.draining && !aiJobStore.queuePaused) {
    void aiJobStore.drain()
  }
})

const showDocPicker = ref(false)
const showBatchDialog = ref(false)
const pickedDocIds = ref<string[]>([])

function startNewAnalysis() {
  showDocPicker.value = true
}

function onDocsPicked(ids: string[]) {
  pickedDocIds.value = ids
  showBatchDialog.value = true
}

async function handleBatchRetry() {
  const count = selectedCount.value
  if (!count) return
  await aiJobStore.retryMany([...selectedIds.value])
  selectNone()
  appStore.showToast(`已重试 ${count} 个任务`, 'success')
}

async function handleBatchDelete() {
  const count = selectedCount.value
  if (!count) return
  await aiJobStore.removeMany([...selectedIds.value])
  selectNone()
  appStore.showToast(`已删除 ${count} 个任务`, 'info')
}

async function handleBatchPriority(priority: AiJobPriority) {
  const count = selectedCount.value
  if (!count) return
  await aiJobStore.setPriorityMany([...selectedIds.value], priority)
  selectNone()
  const label = priority === 'high' ? '高' : priority === 'low' ? '低' : '中'
  appStore.showToast(`已设置 ${count} 个任务优先级为${label}`, 'info')
}
</script>

<template>
  <div class="flex-1 min-h-0 flex-col bg-surface flex">
    <AnalysisQueueHeader
      :select-mode="selectMode"
      @new-analysis="startNewAnalysis"
      @toggle-select-mode="toggleSelectMode"
    />

    <!-- Batch action bar (between header and main, same as before) -->
    <div
      v-if="selectMode && selectedCount > 0"
      class="shrink-0 px-4 py-2 flex items-center gap-2 border-b border-zinc-200 bg-brand/5"
    >
      <span class="text-[12px] font-medium text-brand">
        已选 {{ selectedCount }} 项
      </span>
      <div class="flex-1" />
      <UDropdownMenu
        :items="[
          { key: 'high', label: '高优先级' },
          { key: 'normal', label: '中优先级' },
          { key: 'low', label: '低优先级' },
        ]"
        @select="(item) => handleBatchPriority(item.key as AiJobPriority)"
      >
        <template #trigger>
          <button class="px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-500 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors flex items-center gap-1">
            <ArrowUp class="w-3 h-3" /> 优先级
          </button>
        </template>
      </UDropdownMenu>
      <button
        class="px-2.5 py-1 rounded-md text-[11px] font-medium text-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1"
        @click="handleBatchRetry"
      >
        <RefreshCw class="w-3 h-3" /> 重试
      </button>
      <button
        class="px-2.5 py-1 rounded-md text-[11px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1"
        @click="handleBatchDelete"
      >
        <Trash2 class="w-3 h-3" /> 删除
      </button>
      <button
        class="px-2.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors"
        @click="selectNone"
      >
        取消选择
      </button>
    </div>

    <main class="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-4">
      <AnalysisConfigCenter />

      <AnalysisJobList
        :jobs="filteredJobs"
        :select-mode="selectMode"
        :selected-ids="selectedIds"
        :has-active-filters="hasActiveFilters"
        :filter-status="filter.status"
        @toggle="toggleSelect"
        @select-all="selectAll"
        @select-none="selectNone"
      >
        <template #filters>
          <AnalysisJobFilters
            :filter="filter"
            :has-active-filters="hasActiveFilters"
            @set-filter="setFilter"
            @reset-filter="resetFilter"
          />
        </template>
      </AnalysisJobList>
    </main>

    <DocumentPickerDialog
      :open="showDocPicker"
      @close="showDocPicker = false"
      @confirm="onDocsPicked"
    />
    <BatchAnalysisDialog
      :open="showBatchDialog"
      :document-count="pickedDocIds.length"
      :document-ids="pickedDocIds"
      @close="showBatchDialog = false"
    />
  </div>
</template>
