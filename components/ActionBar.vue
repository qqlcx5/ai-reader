<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useContentStore } from '@/stores/content';
import { useSettingsStore } from '@/stores/settings';
import { useComparisonStore } from '@/stores/comparison';
import { useTemplatesStore } from '@/stores/templates';
import { useWorkflowStore } from '@/stores/workflow';
import { estimateTokens, estimateCost, formatCost } from '@/utils/cost';
import { toMarkdown, toPDF, toObsidianUri, toNotion } from '@/utils/export';
import { Play, Square, Send, RefreshCw, ChevronDown, FileText, Download, BookOpen, Clipboard, Check } from 'lucide-vue-next';
import BaseDialog from './base/BaseDialog.vue';
import BaseButton from './base/BaseButton.vue';
import BaseIconButton from './base/BaseIconButton.vue';
import ModeSwitcher from './ModeSwitcher.vue';
import RoundtableConfig from './RoundtableConfig.vue';
import ChainConfig from './ChainConfig.vue';

const content = useContentStore();
const settings = useSettingsStore();
const comparison = useComparisonStore();
const templates = useTemplatesStore();
const workflow = useWorkflowStore();

const customPrompt = ref('');
const showCostDialog = ref(false);
const pendingCost = ref(0);
const pendingModels = ref<{ name: string; cost: number }[]>([]);
const pendingTokens = ref(0);
const pendingPrompt = ref('');

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

function handleExtract() {
  content.fetchContent();
}

const canRun = computed(() => !!content.rawContent && !comparison.isRunning);
const isRunning = computed(() => comparison.isRunning);
const hasCompletedSummaries = computed(() => comparison.slots.some(s => s.text));

const completedSummaries = computed(() =>
  comparison.slots.filter(s => s.text).map(s => ({
    providerId: s.providerId,
    modelId: s.modelId,
    text: s.text,
  }))
);

// Export actions (1.html style inline buttons)
const exportCopied = ref(false);
function exportMarkdown() {
  const md = toMarkdown(content.title, content.url, completedSummaries.value);
  navigator.clipboard.writeText(md);
  flashCopied();
}
function exportPDF() {
  toPDF(content.title, content.url, completedSummaries.value);
}
function exportObsidian() {
  const uri = toObsidianUri(content.title, completedSummaries.value);
  if (uri.startsWith('clipboard:')) {
    navigator.clipboard.writeText(uri.slice(9));
  } else {
    window.open(uri, '_blank');
  }
  flashCopied();
}
function exportNotion() {
  toNotion(content.title, completedSummaries.value);
  flashCopied();
}
function flashCopied() {
  exportCopied.value = true;
  setTimeout(() => { exportCopied.value = false; }, 1500);
}
</script>

<template>
  <!-- 1.html-style Command Console layout -->
  <div class="flex flex-col gap-2">
    <!-- Row 1: Mode switcher + Template dropdown + Extract -->
    <div class="flex items-center justify-between gap-2">
      <!-- Mode segment control -->
      <ModeSwitcher />

      <div class="flex items-center gap-1.5">
        <!-- Template dropdown (1.html style) -->
        <select
          v-if="workflow.workMode === 'parallel'"
          class="text-[11px] font-medium text-[var(--text-muted)] bg-[var(--background-canvas)] border border-[var(--background-modifier-border)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] py-1 px-2.5 outline-none hover:bg-[var(--background-modifier-hover)] transition-all cursor-pointer"
          @change="(e) => {
            const target = e.target as HTMLSelectElement;
            if (target.value) startWithPrompt(target.value);
            target.selectedIndex = 0;
          }"
        >
          <option value="" disabled selected>⚡ 快速模板</option>
          <option
            v-for="t in templates.templates"
            :key="t.id"
            :value="t.prompt"
          >
            {{ t.name }}
          </option>
        </select>

        <!-- Extract button (moved from header into console) -->
        <button
          v-if="!content.rawContent"
          type="button"
          class="btn-primary-sm"
          :class="content.loading && 'opacity-70 cursor-wait'"
          :disabled="content.loading"
          aria-label="提取页面内容"
          @click="handleExtract"
        >
          <RefreshCw v-if="!content.loading" class="w-3 h-3" />
          <span v-else class="w-3 h-3 inline-block border-2 border-current border-t-transparent rounded-full animate-spin" />
          Extract
        </button>
      </div>
    </div>

    <!-- Roundtable / Chain config (when not in parallel mode) -->
    <RoundtableConfig v-if="workflow.workMode === 'roundtable'" />
    <ChainConfig v-else-if="workflow.workMode === 'chain'" />

    <!-- Row 2: Input + Run/Stop button (1.html style: rounded-xl container, indigo focus ring) -->
    <div
      class="flex items-end gap-2 bg-[var(--background-canvas)] border border-[var(--background-modifier-border)] rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-[var(--color-accent)]/10 focus-within:border-[var(--color-accent)] transition-all"
    >
      <textarea
        v-model="customPrompt"
        class="flex-1 text-[13px] text-[var(--text-normal)] bg-transparent border-none outline-none resize-none py-1.5 px-2 max-h-[100px] no-scrollbar placeholder:text-[var(--text-faint)]"
        rows="1"
        placeholder="说点什么或按 Enter 总结当前页..."
        :disabled="!canRun"
        aria-label="自定义提示词输入"
        @keydown.enter.exact.prevent="startCustom"
      />
      <button
        v-if="!isRunning"
        type="button"
        class="w-8 h-8 rounded-lg bg-[var(--interactive-accent)] hover:bg-[var(--interactive-accent-hover)] text-white flex items-center justify-center shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        :class="isRunning ? 'bg-[var(--text-error)] hover:brightness-110 shadow-rose-200' : 'shadow-indigo-100'"
        :disabled="!canRun || !customPrompt.trim()"
        aria-label="发送"
        @click="startCustom"
      >
        <Send class="w-3.5 h-3.5" />
      </button>
      <button
        v-else
        type="button"
        class="w-8 h-8 rounded-lg bg-[var(--text-error)] hover:brightness-110 text-white flex items-center justify-center shadow-lg shadow-rose-200 transition-all animate-pulse"
        aria-label="停止全部"
        @click="abortAll"
      >
        <Square class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Row 3: Export buttons (1.html style bottom action row) -->
    <div
      v-if="hasCompletedSummaries"
      class="flex justify-between gap-1 pt-1 border-t border-[var(--color-base-10)]"
    >
      <button
        type="button"
        class="flex-1 py-1 text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-normal)] hover:bg-[var(--background-canvas)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] transition-colors flex items-center justify-center gap-1"
        @click="exportMarkdown"
      >
        <FileText class="w-3 h-3" />
        MD
      </button>
      <button
        type="button"
        class="flex-1 py-1 text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-normal)] hover:bg-[var(--background-canvas)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] transition-colors flex items-center justify-center gap-1"
        @click="exportPDF"
      >
        <Download class="w-3 h-3 text-[var(--text-error)]" />
        PDF
      </button>
      <button
        type="button"
        class="flex-1 py-1 text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-normal)] hover:bg-[var(--background-canvas)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] transition-colors flex items-center justify-center gap-1"
        @click="exportObsidian"
      >
        <BookOpen class="w-3 h-3 text-[var(--text-accent)]" />
        Obsidian
      </button>
      <button
        type="button"
        class="flex-1 py-1 text-[11px] font-bold text-[var(--text-muted)] hover:text-[var(--text-normal)] hover:bg-[var(--background-canvas)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] transition-colors flex items-center justify-center gap-1"
        @click="exportNotion"
      >
        <component :is="exportCopied ? Check : Clipboard" class="w-3 h-3" />
        {{ exportCopied ? '已复制' : 'Notion' }}
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
