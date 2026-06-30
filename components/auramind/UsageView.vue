<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { Gauge } from '@lucide/vue'
import { useModelStore } from '@/stores/model.store'
import { ChatRepository } from '@/db/repositories/chat.repository'
import { aggregateUsage, formatTokens, formatCNY, type UsageAggregate } from '@/utils/cost'

const modelStore = useModelStore()
const usage = ref<UsageAggregate | null>(null)

onMounted(async () => {
  await modelStore.loadModels()
  const all = await ChatRepository.findAllSorted()
  usage.value = aggregateUsage(all, modelStore.models)
})

function formatMs(ms: number): string {
  if (ms <= 0) return '—'
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(1) + 's'
}

function formatRate(r: number): string {
  return (r * 100).toFixed(1) + '%'
}
</script>

<template>
  <div class="flex-1 min-h-0 flex-col bg-[#F4F4F5] flex">
    <!-- Header -->
    <div class="h-12 shrink-0 px-4 flex items-center border-b border-zinc-200/70 bg-[#F4F4F5]/90 backdrop-blur-md">
      <div class="text-[14px] font-semibold flex items-center gap-2">
        <Gauge class="w-4 h-4 text-brand" />
        模型用量
      </div>
    </div>

    <main class="flex-1 min-h-0 overflow-y-auto px-4 py-5 flex flex-col gap-5">
      <!-- Empty state -->
      <div v-if="!usage || usage.totalMessages === 0" class="text-center text-[13px] text-zinc-400 py-16">
        暂无用量数据，发起对话后这里会显示统计
      </div>

      <template v-else>
        <!-- Metric cards -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
            <div class="text-[10px] text-zinc-400">Token 用量</div>
            <div class="text-[20px] font-semibold text-zinc-900 mt-1">{{ formatTokens(usage.totalTokens) }}</div>
            <div class="text-[10px] text-zinc-400 mt-1">↑{{ formatTokens(usage.totalPrompt) }} 输入 · ↓{{ formatTokens(usage.totalCompletion) }} 输出</div>
          </div>
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
            <div class="text-[10px] text-zinc-400">累计花费</div>
            <div class="text-[20px] font-semibold text-zinc-900 mt-1">{{ formatCNY(usage.totalCost) }}</div>
            <div class="text-[10px] text-zinc-400 mt-1">参考价（手填优先）</div>
          </div>
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
            <div class="text-[10px] text-zinc-400">平均延迟</div>
            <div class="text-[20px] font-semibold text-zinc-900 mt-1">{{ formatMs(usage.avgDurationMs) }}</div>
            <div class="text-[10px] text-zinc-400 mt-1">生成耗时（发送→完成）</div>
          </div>
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
            <div class="text-[10px] text-zinc-400">错误率</div>
            <div class="text-[20px] font-semibold mt-1" :class="usage.errorRate > 0 ? 'text-red-500' : 'text-zinc-900'">{{ formatRate(usage.errorRate) }}</div>
            <div class="text-[10px] text-zinc-400 mt-1">{{ usage.failedMessages }} / {{ usage.totalMessages }} 次失败</div>
          </div>
        </div>

        <!-- Per model -->
        <section v-if="usage.byModel.length > 0" class="flex flex-col gap-2.5">
          <h2 class="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">按模型</h2>
          <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div
              v-for="m in usage.byModel"
              :key="m.modelId"
              class="flex items-center justify-between px-3.5 py-3 border-b border-zinc-100 last:border-b-0"
            >
              <div class="min-w-0">
                <div class="text-[13px] font-medium text-zinc-900 truncate">{{ m.name }}</div>
                <div class="text-[10px] text-zinc-400 mt-0.5">
                  {{ m.total }} 次 · ↑{{ formatTokens(m.promptTokens) }} ↓{{ formatTokens(m.completionTokens) }}
                </div>
              </div>
              <div class="text-right shrink-0 ml-3">
                <div class="text-[13px] font-medium text-zinc-900 tabular-nums">{{ formatCNY(m.cost) }}</div>
                <div class="text-[10px] text-zinc-400 mt-0.5 tabular-nums">{{ formatMs(m.avgDurationMs) }} · {{ formatRate(m.errorRate) }}</div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
