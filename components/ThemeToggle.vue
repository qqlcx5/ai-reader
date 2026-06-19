<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { Sun, Moon, Monitor } from 'lucide-vue-next';
import { browser } from 'wxt/browser';

const emit = defineEmits<{
  change: [theme: 'light' | 'dark' | 'auto'];
}>();

const current = ref<'light' | 'dark' | 'auto'>('auto');

const themes = [
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
  { value: 'auto' as const, icon: Monitor, label: 'System' },
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
  <div
    class="inline-flex items-center bg-[var(--background-secondary)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] p-0.5"
    role="radiogroup"
    aria-label="Theme"
  >
    <button
      v-for="t in themes"
      :key="t.value"
      type="button"
      :aria-label="t.label"
      :title="t.label"
      :aria-pressed="current === t.value"
      class="w-6 h-6 rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] flex items-center justify-center transition-colors focus-visible:outline-none"
      :class="current === t.value
        ? 'bg-[var(--background-primary)] text-[var(--text-normal)] shadow-[var(--input-shadow)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text-normal)]'"
      @click="setTheme(t.value)"
    >
      <component :is="t.icon" class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
