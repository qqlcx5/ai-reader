<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useContentStore } from '@/stores/content';
import { useSettingsStore } from '@/stores/settings';
import { useComparisonStore } from '@/stores/comparison';
import { useTemplatesStore } from '@/stores/templates';
import { estimateTokens, estimateCost, formatCost } from '@/utils/cost';
import { Play, Square, Send, Plus, ChevronDown, FileText } from 'lucide-vue-next';
import BaseDialog from './base/BaseDialog.vue';
import BaseButton from './base/BaseButton.vue';
import BaseIconButton from './base/BaseIconButton.vue';

const content = useContentStore();
const settings = useSettingsStore();
const comparison = useComparisonStore();
const templates = useTemplatesStore();

const customPrompt = ref('');
const showCostDialog = ref(false);
const pendingCost = ref(0);
const pendingModels = ref<{ name: string; cost: number }[]>([]);
const pendingTokens = ref(0);
const pendingPrompt = ref('');

const showTemplateMenu = ref(false);
const menuRef = ref<HTMLElement | null>(null);

function closeMenu(e?: MouseEvent) {
  if (!e) { showTemplateMenu.value = false; return; }
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    showTemplateMenu.value = false;
  }
}

onMounted(() => document.addEventListener('click', closeMenu));
onUnmounted(() => document.removeEventListener('click', closeMenu));

function calculateCostEstimate(prompt: string) {
  const fullPrompt = `${prompt}\n\n${content.rawContent || ''}`;
  const inputTokens = estimateTokens(fullPrompt);
  const outputTokens = 500;
  const models = settings.enabledProviders.map((id) => {
    const config = settings.getProviderConfig(id);
    return { name: `${id} (${config.model})`, cost: estimateCost(config.model, inputTokens, outputTokens) };
  });
  const total = models.reduce((sum, m) => sum + m.cost, 0);
  return { total, models, tokens: inputTokens + outputTokens };
}

function startWithPrompt(prompt: string) {
  if (!content.rawContent) return;
  showTemplateMenu.value = false;

  const skipConfirm = sessionStorage.getItem('ai-reader-skip-cost-confirm');
  if (skipConfirm === 'true') {
    doStart(prompt);
    return;
  }

  const estimate = calculateCostEstimate(prompt);
  if (estimate.total > 0.01) {
    pendingCost.value = estimate.total;
    pendingModels.value = estimate.models;
    pendingTokens.value = estimate.tokens;
    pendingPrompt.value = prompt;
    showCostDialog.value = true;
    return;
  }

  doStart(prompt);
}

function doStart(prompt: string) {
  const fullPrompt = `${prompt}\n\n${content.rawContent}`;
  comparison.initSlots(settings.enabledProviders);
  comparison.startAll(fullPrompt);
}

function handleCostConfirm() {
  showCostDialog.value = false;
  doStart(pendingPrompt.value);
}

function handleCostCancel() {
  showCostDialog.value = false;
  pendingPrompt.value = '';
  pendingCost.value = 0;
}

function handleSkipCostConfirmChange(checked: boolean) {
  try {
    sessionStorage.setItem('ai-reader-skip-cost-confirm', checked ? 'true' : 'false');
  } catch {}
}

function startCustom() {
  if (!customPrompt.value.trim()) return;
  startWithPrompt(customPrompt.value.trim());
}

function abortAll() {
  comparison.abortAll();
}

const canRun = computed(() => !!content.rawContent && !comparison.isRunning);
</script>

<template>
  <div class="border-b border-[var(--background-modifier-border)] bg-[var(--background-primary)]">
    <!-- Template bar -->
    <div class="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-thin">
      <div ref="menuRef" class="relative shrink-0">
        <button
          type="button"
          class="btn-secondary-sm"
          :disabled="!canRun"
          @click.stop="showTemplateMenu = !showTemplateMenu"
        >
          <Plus class="w-3 h-3" />
          Templates
          <ChevronDown class="w-3 h-3" />
        </button>
        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-75 ease-in"
          leave-to-class="opacity-0"
        >
          <div v-if="showTemplateMenu" class="menu top-9 left-0" role="menu">
            <button
              v-for="t in templates.templates"
              :key="t.id"
              type="button"
              class="menu-item"
              role="menuitem"
              @click="startWithPrompt(t.prompt)"
            >
              <FileText class="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <div class="flex-1 min-w-0 text-left">
                <div class="font-medium">{{ t.name }}</div>
                <div class="text-[10px] text-[var(--text-faint)] line-clamp-1">{{ t.prompt }}</div>
              </div>
            </button>
          </div>
        </Transition>
      </div>

      <div class="h-4 w-px bg-[var(--background-modifier-border)] shrink-0 mx-0.5" />

      <button
        v-for="t in templates.templates.slice(0, 4)"
        :key="t.id"
        type="button"
        class="btn-secondary-sm shrink-0"
        :disabled="!canRun"
        @click="startWithPrompt(t.prompt)"
      >
        <Play class="w-3 h-3" />
        {{ t.name }}
      </button>

      <div class="ml-auto shrink-0">
        <button
          v-if="comparison.isRunning"
          type="button"
          class="btn-danger-sm"
          aria-label="停止全部"
          @click="abortAll"
        >
          <Square class="w-3 h-3" />
          Stop
        </button>
      </div>
    </div>

    <!-- Custom prompt row -->
    <div class="flex items-center gap-1.5 px-3 pb-2">
      <div class="flex-1 relative">
        <input
          v-model="customPrompt"
          type="text"
          placeholder="自定义提示词…"
          class="input-md pr-2"
          :disabled="!canRun"
          aria-label="自定义提示词输入"
          @keyup.enter="startCustom"
        />
      </div>
      <button
        type="button"
        class="btn-primary-sm"
        :disabled="!canRun || !customPrompt.trim()"
        aria-label="发送"
        @click="startCustom"
      >
        <Send class="w-3 h-3" />
        发送
      </button>
    </div>

    <!-- Cost confirmation dialog -->
    <BaseDialog
      :open="showCostDialog"
      title="确认发送请求"
      width="440px"
      @close="handleCostCancel"
    >
      <div class="space-y-3">
        <p class="text-[var(--text-muted)]">
          此次请求预计消耗 <strong class="text-[var(--text-normal)]">{{ pendingTokens.toLocaleString() }}</strong> tokens，预估费用如下：
        </p>
        <div class="setting-items !border-[var(--background-modifier-border)]">
          <div
            v-for="(m, i) in pendingModels"
            :key="i"
            class="setting-item-mod-horizontal !py-2"
          >
            <span class="text-[var(--font-ui-smaller)] text-[var(--text-normal)] truncate">{{ m.name }}</span>
            <span class="pill-success">{{ formatCost(m.cost) }}</span>
          </div>
        </div>
        <div class="setting-item-mod-horizontal !border-0 !px-0 !py-2 !bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]">
          <span class="text-[var(--font-ui-smaller)] font-medium">总计</span>
          <span class="pill-accent text-[var(--font-ui-smaller)]">{{ formatCost(pendingCost) }}</span>
        </div>
        <label class="flex items-center gap-2 text-[var(--font-ui-smaller)] text-[var(--text-muted)] cursor-pointer select-none">
          <input
            type="checkbox"
            class="checkbox-base"
            @change="(e) => handleSkipCostConfirmChange((e.target as HTMLInputElement).checked)"
          />
          <span>本次会话不再提示</span>
        </label>
      </div>
      <template #footer>
        <BaseButton variant="secondary" size="sm" @click="handleCostCancel">取消</BaseButton>
        <BaseButton variant="primary" size="sm" @click="handleCostConfirm">
          确认发送
          ({{ formatCost(pendingCost) }})
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
