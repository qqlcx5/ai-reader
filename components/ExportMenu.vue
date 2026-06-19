<script lang="ts" setup>
import { ref } from 'vue';
import { toMarkdown, toPDF, toObsidianUri, toNotion } from '@/utils/export';
import { Download, FileText, BookOpen, Clipboard } from 'lucide-vue-next';

const props = defineProps<{
  title: string;
  content: string;
  url: string;
}>();

const showMenu = ref(false);
const copied = ref(false);

function copyMarkdown() {
  const md = toMarkdown(props.title, props.content, props.url);
  navigator.clipboard.writeText(md);
  copied.value = true;
  setTimeout(() => { copied.value = false; showMenu.value = false; }, 1500);
}

function downloadPDF() {
  toPDF(props.title, props.content);
  showMenu.value = false;
}

function openObsidian() {
  const uri = toObsidianUri(props.title, props.content);
  window.open(uri, '_blank');
  showMenu.value = false;
}

async function copyNotion() {
  await toNotion(props.title, props.content);
  copied.value = true;
  setTimeout(() => { copied.value = false; showMenu.value = false; }, 1500);
}
</script>

<template>
  <div class="relative">
    <button
      @click="showMenu = !showMenu"
      class="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
      title="Export"
    >
      <Download class="w-4 h-4" />
    </button>

    <div
      v-if="showMenu"
      class="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
    >
      <button
        @click="copyMarkdown"
        class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
      >
        <FileText class="w-4 h-4" />
        {{ copied ? 'Copied!' : 'Copy Markdown' }}
      </button>
      <button
        @click="downloadPDF"
        class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
      >
        <Download class="w-4 h-4" />
        Download PDF
      </button>
      <button
        @click="openObsidian"
        class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
      >
        <BookOpen class="w-4 h-4" />
        Open in Obsidian
      </button>
      <button
        @click="copyNotion"
        class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
      >
        <Clipboard class="w-4 h-4" />
        Copy for Notion
      </button>
    </div>
  </div>
</template>
