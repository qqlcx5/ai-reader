<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { Sun, Moon, Monitor } from 'lucide-vue-next';
import { browser } from 'wxt/browser';

const emit = defineEmits<{
  change: [theme: 'light' | 'dark' | 'auto'];
}>();

const current = ref<'light' | 'dark' | 'auto'>('auto');

const themes = [
  { value: 'light' as const, icon: Sun, label: '浅色' },
  { value: 'dark' as const, icon: Moon, label: '深色' },
  { value: 'auto' as const, icon: Monitor, label: '跟随系统' },
];

async function loadTheme() {
  try {
    const data = await browser.storage.local.get('ai-reader-theme');
    current.value = (data['ai-reader-theme'] as typeof current.value) || 'auto';
  } catch { current.value = 'auto'; }
}

async function setTheme(t: 'light' | 'dark' | 'auto') {
  current.value = t;
  try { await browser.storage.local.set({ 'ai-reader-theme': t }); } catch {}
  emit('change', t);
}

onMounted(loadTheme);
</script>

<template>
  <div class="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
    <button v-for="t in themes" :key="t.value" @click="setTheme(t.value)"
      class="p-1 rounded transition-colors"
      :class="current === t.value ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'"
      :aria-label="t.label" :title="t.label">
      <component :is="t.icon" class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
