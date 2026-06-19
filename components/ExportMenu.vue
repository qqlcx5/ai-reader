<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { toMarkdown, toPDF, toObsidianUri, toNotion, toCsv, downloadCsv } from '@/utils/export';
import type { HistoryCsvRow } from '@/utils/export';
import { useHistoryStore } from '@/stores/history';
import { Download, FileText, BookOpen, Clipboard, Check, Table } from 'lucide-vue-next';

interface ModelSummary {
  providerId: string;
  modelId: string;
  text: string;
}

const props = defineProps<{
  title: string;
  url: string;
  summaries: ModelSummary[];
}>();

const history = useHistoryStore();
const showMenu = ref(false);
const copied = ref(false);
const menuRef = ref<HTMLElement | null>(null);

function onClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    showMenu.value = false;
  }
}

onMounted(() => document.addEventListener('click', onClickOutside));
onUnmounted(() => document.removeEventListener('click', onClickOutside));

function copyMarkdown() {
  const md = toMarkdown(props.title, props.url, props.summaries);
  navigator.clipboard.writeText(md);
  copied.value = true;
  setTimeout(() => { copied.value = false; showMenu.value = false; }, 1500);
}

function downloadPDF() {
  toPDF(props.title, props.url, props.summaries);
  showMenu.value = false;
}

function openObsidian() {
  const uri = toObsidianUri(props.title, props.summaries);
  if (uri.startsWith('clipboard:')) {
    navigator.clipboard.writeText(uri.slice(9));
    copied.value = true;
    setTimeout(() => { copied.value = false; showMenu.value = false; }, 1500);
  } else {
    window.open(uri, '_blank');
    showMenu.value = false;
  }
}

async function copyNotion() {
  await toNotion(props.title, props.summaries);
  copied.value = true;
  setTimeout(() => { copied.value = false; showMenu.value = false; }, 1500);
}

function exportHistoryCsv() {
  const rows: HistoryCsvRow[] = [];
  for (const entry of history.entries) {
    for (const r of entry.responses) {
      rows.push({
        title: entry.title,
        url: entry.url,
        timestamp: new Date(entry.timestamp).toISOString(),
        prompt: entry.prompt,
        providerId: r.providerId,
        modelId: r.modelId,
        responseText: r.text,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        estimatedCost: r.estimatedCost,
        elapsedMs: r.elapsedMs,
        status: r.status,
      });
    }
  }
  const csv = toCsv(rows);
  downloadCsv(`ai-reader-history-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  showMenu.value = false;
}
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      type="button"
      class="clickable-icon"
      aria-label="导出"
      title="导出"
      @click="showMenu = !showMenu"
    >
      <Download class="w-4 h-4" />
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="opacity-0"
    >
      <div v-if="showMenu" class="menu top-9 right-0" role="menu">
        <button
          type="button"
          class="menu-item"
          role="menuitem"
          @click="copyMarkdown"
        >
          <component :is="copied ? Check : FileText" class="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>{{ copied ? '已复制' : '复制 Markdown' }}</span>
        </button>
        <button type="button" class="menu-item" role="menuitem" @click="downloadPDF">
          <Download class="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>下载 PDF</span>
        </button>
        <button type="button" class="menu-item" role="menuitem" @click="openObsidian">
          <BookOpen class="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>在 Obsidian 中打开</span>
        </button>
        <button type="button" class="menu-item" role="menuitem" @click="copyNotion">
          <Clipboard class="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>复制为 Notion 格式</span>
        </button>
        <div class="border-t border-[var(--background-modifier-border)] my-0.5" />
        <button type="button" class="menu-item" role="menuitem" @click="exportHistoryCsv">
          <Table class="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>导出历史为 CSV</span>
        </button>
      </div>
    </Transition>
  </div>
</template>
