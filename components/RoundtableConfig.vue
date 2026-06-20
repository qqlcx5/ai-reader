<script lang="ts" setup>
import { computed } from 'vue';
import { Plus, Trash2, Play, Square } from 'lucide-vue-next';
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

const canRun = computed(() => !!content.rawContent && !comparison.isRunning && workflow.roles.length > 0);

function handleStart() {
  if (!content.rawContent) return;
  comparison.initRoundtable(workflow.roles);
  comparison.startRoundtable(content.rawContent);
}

function handleAbort() {
  comparison.abortAll();
}
</script>

<template>
  <div class="px-3 pb-2 space-y-2">
    <!-- Role list -->
    <div class="space-y-1.5">
      <div
        v-for="role in workflow.roles"
        :key="role.id"
        class="setting-items !border-[var(--background-modifier-border)]"
      >
        <div class="setting-item-mod-horizontal !py-2">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <!-- Color picker -->
            <input
              type="color"
              :value="role.color"
              class="w-5 h-5 rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] cursor-pointer border border-[var(--background-modifier-border)] shrink-0"
              title="角色颜色"
              @input="(e) => workflow.updateRole(role.id, { color: (e.target as HTMLInputElement).value })"
            />
            <!-- Name -->
            <input
              :value="role.name"
              type="text"
              class="input-sm !h-6 w-24 font-medium"
              placeholder="角色名"
              @input="(e) => workflow.updateRole(role.id, { name: (e.target as HTMLInputElement).value })"
            />
            <!-- Provider -->
            <select
              :value="role.providerId"
              class="select-base !h-6 !w-32 text-[11px]"
              @change="(e) => workflow.updateRole(role.id, { providerId: (e.target as HTMLSelectElement).value })"
            >
              <option v-for="p in enabledProviderOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <button
            type="button"
            class="clickable-icon !w-6 !h-6 text-[var(--text-error)] hover:!bg-[var(--background-modifier-error)]"
            aria-label="删除角色"
            @click="workflow.removeRole(role.id)"
          >
            <Trash2 class="w-3 h-3" />
          </button>
        </div>
        <!-- Prompt textarea -->
        <div class="px-4 pb-2">
          <textarea
            :value="role.prompt"
            class="textarea-base text-[11px] min-h-[2.5rem]"
            placeholder="角色提示词…"
            rows="2"
            @input="(e) => workflow.updateRole(role.id, { prompt: (e.target as HTMLTextAreaElement).value })"
          />
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="btn-secondary-sm"
        @click="workflow.addRole()"
      >
        <Plus class="w-3 h-3" />
        添加角色
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
          开始圆桌
        </button>
      </div>
    </div>
  </div>
</template>
