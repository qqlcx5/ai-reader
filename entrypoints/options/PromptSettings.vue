<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSettingsStore } from '@/stores/settings.store';
import { modelRepository } from '@/core/models/model.repository';
import type { ModelProviderConfig } from '@/db/schema';

const settingsStore = useSettingsStore();
const models = ref<ModelProviderConfig[]>([]);
const globalPrompt = ref('');
const selectedModelId = ref<string | null>(null);
const modelPrompt = ref('');

const defaultPrompt = '你是一个 AI 阅读助手。请根据以下网页内容回答用户的问题。请用中文回答。';

onMounted(async () => {
  await settingsStore.loadGlobalPrompt();
  globalPrompt.value = settingsStore.globalSystemPrompt;
  models.value = await modelRepository.getAll();
});

async function saveGlobalPrompt() {
  await settingsStore.saveGlobalPrompt(globalPrompt.value);
  alert('全局提示词已保存');
}

function selectModel(model: ModelProviderConfig) {
  selectedModelId.value = model.id;
  modelPrompt.value = model.systemPrompt || '';
}

async function saveModelPrompt() {
  if (!selectedModelId.value) return;
  await modelRepository.update(selectedModelId.value, {
    systemPrompt: modelPrompt.value || undefined,
  });
  models.value = await modelRepository.getAll();
  alert('模型提示词已保存');
}

const templateVars = [
  { key: '{{date}}', desc: '当前日期' },
  { key: '{{url}}', desc: '文档 URL' },
  { key: '{{title}}', desc: '文档标题' },
  { key: '{{language}}', desc: '文档语言' },
];

function insertVar(v: string) {
  globalPrompt.value += v;
}
</script>

<template>
  <div class="space-y-4">
    <!-- Global Prompt -->
    <div class="card p-6">
      <h2 class="text-lg font-semibold text-slate-800 mb-2">全局系统提示词</h2>
      <p class="text-xs text-slate-500 mb-3">适用于所有模型，除非模型单独配置了提示词</p>
      <textarea
        v-model="globalPrompt"
        class="input resize-none"
        rows="6"
        :placeholder="defaultPrompt"
      />
      <div class="flex items-center gap-2 mt-2">
        <span class="text-xs text-slate-500">模板变量：</span>
        <button
          v-for="v in templateVars"
          :key="v.key"
          class="text-xs text-brand-600 hover:underline"
          :title="v.desc"
          @click="insertVar(v.key)"
        >
          {{ v.key }}
        </button>
      </div>
      <button class="btn-primary mt-3" @click="saveGlobalPrompt">保存</button>
    </div>

    <!-- Per-Model Prompt -->
    <div class="card p-6">
      <h2 class="text-lg font-semibold text-slate-800 mb-2">模型专属提示词</h2>
      <p class="text-xs text-slate-500 mb-3">覆盖全局提示词，为空时使用全局配置</p>

      <div class="flex gap-2 flex-wrap mb-3">
        <button
          v-for="model in models"
          :key="model.id"
          class="px-3 py-1 text-xs rounded-full border transition-colors"
          :class="selectedModelId === model.id
            ? 'bg-brand-500 text-white border-brand-500'
            : 'bg-white text-slate-600 border-slate-300 hover:border-brand-300'"
          @click="selectModel(model)"
        >
          {{ model.name }}
        </button>
      </div>

      <div v-if="selectedModelId">
        <textarea
          v-model="modelPrompt"
          class="input resize-none"
          rows="4"
          placeholder="留空则使用全局提示词"
        />
        <button class="btn-primary mt-3" @click="saveModelPrompt">保存</button>
      </div>
      <p v-else class="text-sm text-slate-400">选择一个模型配置专属提示词</p>
    </div>
  </div>
</template>
