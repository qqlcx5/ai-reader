<script lang="ts" setup>
import { ref } from 'vue';
import { toMarkdown, toPDF, toObsidianUri, toNotion } from '@/utils/export';
import { Download, FileText, BookOpen, Clipboard } from 'lucide-vue-next';

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

const showMenu = ref(false);
const copied = ref(false);

function copyMarkdown() {
  const md = toMarkdown(props.title, props.url, props.summaries);
  navigator.clipboard.writeText(md);
  copied.value = true;
  setTimeout(() => { copied.value = false; showMenu.value = false; }, 1500);
}

function downloadPDF() {
  toPDF(props.title, props.summaries);
  showMenu.value = false;
}

function openObsidian() {
  const uri = toObsidianUri(props.title, props.summaries);
  if (uri.startsWith('clipboard:')) {
    // Content too long for URI, copy to clipboard instead
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
</script>

<template>
  <div class="relative">
    <button
      @click="showMenu = !showMenu"
      class="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      aria-label="导出"
    >
      <Download class="w-4 h-4" />
    </button>

    <div
      v-if="showMenu"
      class="absolute right-0 top-8 z-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]"
    >
      <button
        @click="copyMarkdown"
        class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        aria-label="复制 Markdown"
      >
        <FileText class="w-4 h-4" />
        {{ copied ? '已复制!' : '复制 Markdown' }}
      </button>
      <button
        @click="downloadPDF"
        class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        aria-label="下载 PDF"
      >
        <Download class="w-4 h-4" />
        下载 PDF
      </button>
      <button
        @click="openObsidian"
        class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        aria-label="在 Obsidian 中打开"
      >
        <BookOpen class="w-4 h-4" />
        在 Obsidian 中打开
      </button>
      <button
        @click="copyNotion"
        class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        aria-label="复制为 Notion 格式"
      >
        <Clipboard class="w-4 h-4" />
        复制为 Notion 格式
      </button>
    </div>
  </div>
</template>
