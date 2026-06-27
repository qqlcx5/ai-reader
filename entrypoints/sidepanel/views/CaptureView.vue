<script setup lang="ts">
import { onMounted } from 'vue'
import { Globe } from '@lucide/vue'
import { useCurrentPage } from '../composables/useCurrentPage'
import { useCapture } from '../composables/useCapture'
import AppCard from '../components/AppCard.vue'
import ExtractPipeline from './ExtractPipeline.vue'

const { metadata, fetchCurrentPage } = useCurrentPage()
const { startCapture } = useCapture()

onMounted(() => { fetchCurrentPage() })
</script>

<template>
  <div class="p-4 space-y-4">
    <AppCard v-if="metadata.url">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-lg bg-blue/10 flex items-center justify-center flex-shrink-0">
          <Globe class="w-5 h-5 text-blue" />
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-semibold text-text truncate">{{ metadata.title || '未命名页面' }}</h3>
          <p class="text-10px text-gray-400 truncate mt-1">{{ metadata.url }}</p>
          <p v-if="metadata.description" class="text-11px text-gray-500 mt-2 line-clamp-2">{{ metadata.description }}</p>
        </div>
      </div>
    </AppCard>

    <div v-else class="text-center py-8 text-gray-400">
      <Globe class="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p class="text-xs">无法获取当前页面信息</p>
    </div>

    <button
      v-if="metadata.url"
      class="w-full py-2.5 px-4 bg-blue text-white rounded-16px text-sm font-medium hover:bg-blue/90 transition-colors border-0 cursor-pointer"
      aria-label="剪藏此页面"
      @click="startCapture(metadata.url)"
    >
      剪藏此页面
    </button>

    <ExtractPipeline />

    <div class="mt-6">
      <h4 class="text-11px font-semibold text-gray-400 uppercase tracking-wide mb-3">最近保存</h4>
      <p class="text-xs text-gray-400 text-center py-4">暂无保存记录</p>
    </div>
  </div>
</template>
