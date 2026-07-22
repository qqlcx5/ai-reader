<script lang="ts" setup>
import dayjs from 'dayjs'
import { computed } from 'vue'
import { Plus, Trash2, Clock } from '@lucide/vue'
import Switch from '@/components/ui/Switch.vue'
import UInput from '@/components/ui/UInput.vue'
import { useScheduleStore } from '@/stores/schedule.store'
import { useCollectionStore } from '@/stores/collection.store'
import type { ScheduleEntity, ScheduleScope } from '@/types/schedule'
import type { SelectOption } from './select-option'

const props = defineProps<{
  modelOptions: SelectOption[]
  templateOptions: SelectOption[]
}>()

const scheduleStore = useScheduleStore()
const collectionStore = useCollectionStore()

const cronPresets = [
  { label: '每天 23:00', value: '0 23 * * *' },
  { label: '每天 09:00', value: '0 9 * * *' },
  { label: '工作日 09:00', value: '0 9 * * 1-5' },
  { label: '每周日 20:00', value: '0 20 * * 0' },
  { label: '每 6 小时', value: '0 */6 * * *' },
]

const scopeOptions: { value: ScheduleScope; label: string }[] = [
  { value: 'today', label: '当日收藏' },
  { value: 'unread', label: '未读' },
  { value: 'all', label: '全部' },
  { value: 'collection', label: '指定合集' },
]

const collectionOptions = computed<SelectOption[]>(() =>
  collectionStore.collections.map((c) => ({ value: c.id, label: c.name })),
)

function addSchedule() {
  void scheduleStore.save(scheduleStore.createDraft())
}

async function removeSchedule(id: string) {
  await scheduleStore.remove(id)
}

async function persistSchedule(s: ScheduleEntity) {
  await scheduleStore.save(s)
}

function setScope(s: ScheduleEntity, scope: ScheduleScope) {
  s.scope = scope
  void persistSchedule(s)
}

function setCron(s: ScheduleEntity, cron: string) {
  s.cron = cron
  void persistSchedule(s)
}

function scheduleStatusLabel(sched: ScheduleEntity): string {
  if (sched.lastFireError) return `上次失败：${sched.lastFireError}`
  if (sched.lastFiredAt) return `上次执行：${dayjs(sched.lastFiredAt).format('MM-DD HH:mm')}`
  return '尚未执行'
}

const modelOptionsWithDefault = computed<SelectOption[]>(() => [
  { value: '', label: '默认模型' },
  ...props.modelOptions,
])
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-[11px] text-zinc-500">
        定时触发 AI 分析，支持按范围筛选文档
      </div>
      <button
        class="text-[10px] text-brand hover:text-brand-dark flex items-center gap-0.5 px-2 py-1 rounded hover:bg-brand/5"
        @click="addSchedule"
      >
        <Plus class="w-3 h-3" /> 新建计划
      </button>
    </div>

    <div
      v-for="sched in scheduleStore.schedules"
      :key="sched.id"
      class="rounded-lg border border-zinc-200 overflow-hidden"
    >
      <div class="px-3 py-2.5 flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <Switch
            :model-value="sched.enabled"
            @update:model-value="(v: boolean) => { sched.enabled = v; persistSchedule(sched) }"
          />
          <Clock class="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <UInput
            v-model="sched.label"
            class="flex-1 text-[11px] font-medium"
            placeholder="计划名称"
            @change="persistSchedule(sched)"
          />
          <span
            class="text-[9px] shrink-0"
            :class="sched.lastFireError ? 'text-red-500' : 'text-zinc-400'"
          >
            {{ scheduleStatusLabel(sched) }}
          </span>
        </div>
        <button
          class="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-1"
          @click="removeSchedule(sched.id)"
        >
          <Trash2 class="w-3 h-3" />
        </button>
      </div>

      <div class="px-3 py-2.5 space-y-2">
        <!-- Cron -->
        <div class="flex flex-wrap items-center gap-2">
          <label class="text-[10px] text-zinc-500 w-12 shrink-0">执行时间</label>
          <div class="flex flex-wrap gap-1 flex-1 min-w-[140px]">
            <button
              v-for="preset in cronPresets"
              :key="preset.value"
              class="px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors"
              :class="sched.cron === preset.value
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'"
              @click="setCron(sched, preset.value)"
            >
              {{ preset.label }}
            </button>
          </div>
          <UInput
            v-model="sched.cron"
            class="w-28 text-[10px] font-mono"
            placeholder="自定义 Cron"
            @change="persistSchedule(sched)"
          />
        </div>

        <!-- Scope -->
        <div class="flex flex-wrap items-center gap-2">
          <label class="text-[10px] text-zinc-500 w-12 shrink-0">分析范围</label>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="opt in scopeOptions"
              :key="opt.value"
              class="px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors"
              :class="sched.scope === opt.value
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'"
              @click="setScope(sched, opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div v-if="sched.scope === 'collection'" class="flex items-center gap-2 ml-14">
          <label class="text-[10px] text-zinc-500 w-12 shrink-0">合集</label>
          <select
            v-model="sched.collectionId"
            class="flex-1 text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none focus:border-brand"
            @change="persistSchedule(sched)"
          >
            <option value="">选择合集</option>
            <option v-for="opt in collectionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>

        <!-- Model + Template -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[9px] text-zinc-400 block mb-0.5">模型</label>
            <select
              v-model="sched.modelId"
              class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none focus:border-brand"
              @change="persistSchedule(sched)"
            >
              <option v-for="opt in modelOptionsWithDefault" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div>
            <label class="text-[9px] text-zinc-400 block mb-0.5">模板</label>
            <select
              v-model="sched.promptTemplateId"
              class="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none focus:border-brand"
              @change="persistSchedule(sched)"
            >
              <option v-for="opt in props.templateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!scheduleStore.schedules.length" class="text-center py-6 text-[11px] text-zinc-400">
      暂无定时计划
    </div>
  </div>
</template>
