<script lang="ts" setup>
import { computed } from 'vue';
import { Plus, Trash2, Play, Square, ChevronUp, ChevronDown, ArrowDown } from 'lucide-vue-next';
import { useWorkflowStore } from '@/stores/workflow';
import { useComparisonStore } from '@/stores/comparison';
import { useSettingsStore } from '@/stores/settings';
import { useContentStore } from '@/stores/content';
import { PROVIDER_META } from '@/utils/providers';

const workflow = useWorkflowStore();
const comparison = useComparisonStore();
const settings = useSettingsStore();
const content = useContentStore();

const enabledProviderOptions = computed(() => {
  return settings.enabledProviders.map(id => ({
    id,
    name: PROVIDER_META[id]?.name ?? id,
  }));
});

const canRun = computed(() => !!content.rawContent && !comparison.isRunning && workflow.chainSteps.length > 0);

function onProviderChange(stepId: string, providerId: string) {
  const config = settings.getProviderConfig(providerId);
  workflow.updateChainStep(stepId, { providerId, modelId: config.model });
}

function handleStart() {
  if (!content.rawContent) return;
  comparison.initChain(workflow.chainSteps);
  comparison.startChain(content.rawContent);
}

function handleAbort() {
  comparison.abortAll();
}
</script>

<template>
  <div class="px-3 pb-2 space-y-2">
    <!-- Chain steps list -->
    <div class="space-y-1">
      <template v-for="(step, idx) in workflow.chainSteps" :key="step.id">
        <!-- Step card -->
        <div class="setting-items !border-[var(--background-modifier-border)]">
          <div class="setting-item-mod-horizontal !py-2">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <!-- Step badge -->
              <span class="pill-accent !text-[10px] !py-0 shrink-0">Step {{ idx + 1 }}</span>
              <!-- Provider -->
              <select
                :value="step.providerId"
                class="select-base !h-6 !w-32 text-[11px]"
                @change="(e) => onProviderChange(step.id, (e.target as HTMLSelectElement).value)"
              >
                <option v-for="p in enabledProviderOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <!-- Model display -->
              <span class="text-[10px] text-[var(--text-faint)] truncate">{{ step.modelId }}</span>
            </div>
            <div class="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                class="clickable-icon !w-5 !h-5"
                :disabled="idx === 0"
                aria-label="上移"
                @click="workflow.moveChainStep(step.id, 'up')"
              >
                <ChevronUp class="w-3 h-3" />
              </button>
              <button
                type="button"
                class="clickable-icon !w-5 !h-5"
                :disabled="idx === workflow.chainSteps.length - 1"
                aria-label="下移"
                @click="workflow.moveChainStep(step.id, 'down')"
              >
                <ChevronDown class="w-3 h-3" />
              </button>
              <button
                type="button"
                class="clickable-icon !w-5 !h-5 text-[var(--text-error)] hover:!bg-[var(--background-modifier-error)]"
                aria-label="删除步骤"
                @click="workflow.removeChainStep(step.id)"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
          <!-- Prompt textarea -->
          <div class="px-4 pb-2">
            <textarea
              :value="step.prompt"
              class="textarea-base text-[11px] min-h-[2.5rem]"
              placeholder="该步骤的任务指令…"
              rows="2"
              @input="(e) => workflow.updateChainStep(step.id, { prompt: (e.target as HTMLTextAreaElement).value })"
            />
          </div>
        </div>

        <!-- Flow wire connector (between steps) -->
        <div v-if="idx < workflow.chainSteps.length - 1" class="flex justify-center py-0.5">
          <div class="flow-wire h-4"></div>
        </div>
      </template>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="btn-secondary-sm"
        @click="workflow.addChainStep()"
      >
        <Plus class="w-3 h-3" />
        添加步骤
      </button>
      <div class="ml-auto">
        <button
          v-if="comparison.isRunning"
          type="button"
          class="btn-danger-sm"
          @click="handleAbort"
        >
          <Square class="w-3 h-3" />
          Stop
        </button>
        <button
          v-else
          type="button"
          class="btn-primary-sm"
          :disabled="!canRun"
          @click="handleStart"
        >
          <Play class="w-3 h-3" />
          开始链式
        </button>
      </div>
    </div>
  </div>
</template>
