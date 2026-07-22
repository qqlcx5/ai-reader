<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { TrendingUp, Timer, CheckCircle2, DollarSign } from '@lucide/vue'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useModelStore } from '@/stores/model.store'
import { ChatRepository } from '@/db/repositories/chat.repository'
import { aggregateUsage, formatTokens, formatCNY, type UsageAggregate } from '@/utils/cost'

const aiJobStore = useAiJobStore()
const modelStore = useModelStore()

const usageStats = ref<UsageAggregate>(aggregateUsage([], []))

async function refresh() {
  const conversations = await ChatRepository.findAll()
  usageStats.value = aggregateUsage(conversations, modelStore.models)
}

const costStats = computed(() => ({
  totalJobs: usageStats.value.totalMessages,
  inputTokens: usageStats.value.totalPrompt,
  outputTokens: usageStats.value.totalCompletion,
  totalTokens: usageStats.value.totalTokens,
  actualCostCNY: usageStats.value.totalCost,
  avgDurationMs: usageStats.value.avgDurationMs,
  successRate: aiJobStore.stats.successRate,
}))

const modelBreakdown = computed(() => {
  const total = aiJobStore.stats.total || 1
  return modelStore.models
    .map((m) => ({
      model: m,
      count: aiJobStore.jobs.filter((j) => j.modelId === m.id).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((s) => ({ ...s, percent: (s.count / total) * 100 }))
})

// Refresh whenever the job count or success count changes (new analysis finished)
watch(
  () => [aiJobStore.stats.total, aiJobStore.stats.success] as const,
  () => { void refresh() },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-3">
    <!-- Summary cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div class="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
        <div class="flex items-center gap-1 text-[9px] text-zinc-400">
          <TrendingUp class="w-2.5 h-2.5" /> 总响应
        </div>
        <div class="text-[16px] font-bold text-zinc-900 mt-0.5">{{ costStats.totalJobs }}</div>
      </div>
      <div class="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
        <div class="flex items-center gap-1 text-[9px] text-zinc-400">
          <Timer class="w-2.5 h-2.5" /> 平均耗时
        </div>
        <div class="text-[16px] font-bold text-zinc-900 mt-0.5">
          {{ costStats.avgDurationMs > 0 ? `${(costStats.avgDurationMs / 1000).toFixed(1)}s` : '—' }}
        </div>
      </div>
      <div class="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
        <div class="flex items-center gap-1 text-[9px] text-zinc-400">
          <CheckCircle2 class="w-2.5 h-2.5 text-emerald-500" /> 成功率
        </div>
        <div class="text-[16px] font-bold text-emerald-600 mt-0.5">
          {{ costStats.successRate > 0 ? `${(costStats.successRate * 100).toFixed(0)}%` : '—' }}
        </div>
      </div>
      <div class="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
        <div class="flex items-center gap-1 text-[9px] text-zinc-400">
          <DollarSign class="w-2.5 h-2.5" /> 实际成本
        </div>
        <div class="text-[16px] font-bold text-amber-600 mt-0.5">
          {{ costStats.actualCostCNY > 0 ? formatCNY(costStats.actualCostCNY) : '—' }}
        </div>
      </div>
    </div>

    <!-- Token usage -->
    <div class="rounded-lg border border-zinc-200 p-3">
      <div class="text-[11px] font-medium text-zinc-600 mb-2">实际 Token 用量</div>
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-[10px]">
          <span class="text-zinc-500">输入 Tokens</span>
          <span class="font-mono text-zinc-700">{{ formatTokens(costStats.inputTokens) }}</span>
        </div>
        <div class="flex items-center justify-between text-[10px]">
          <span class="text-zinc-500">输出 Tokens</span>
          <span class="font-mono text-zinc-700">{{ formatTokens(costStats.outputTokens) }}</span>
        </div>
        <div class="flex items-center justify-between text-[10px] pt-1.5 border-t border-zinc-100">
          <span class="text-zinc-500 font-medium">总计</span>
          <span class="font-mono text-zinc-900 font-bold">{{ formatTokens(costStats.totalTokens) }}</span>
        </div>
      </div>
    </div>

    <!-- Per-model breakdown -->
    <div class="rounded-lg border border-zinc-200 p-3">
      <div class="text-[11px] font-medium text-zinc-600 mb-2">模型响应分布</div>
      <div v-if="!modelBreakdown.length" class="text-center py-3 text-[10px] text-zinc-400">
        暂无数据
      </div>
      <div v-else class="space-y-1.5">
        <div
          v-for="stat in modelBreakdown"
          :key="stat.model.id"
          class="flex items-center gap-2"
        >
          <span class="text-[10px] text-zinc-600 w-24 truncate shrink-0">{{ stat.model.name }}</span>
          <div class="flex-1 h-3 bg-zinc-100 rounded-full overflow-hidden min-w-[40px]">
            <div
              class="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 transition-all duration-500"
              :style="{ width: `${stat.percent}%` }"
            />
          </div>
          <span class="text-[10px] font-mono text-zinc-500 w-8 text-right tabular-nums shrink-0">{{ stat.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
