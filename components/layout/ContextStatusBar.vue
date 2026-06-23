<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useContextStore } from '@/stores/context.store';

const ctx = useContextStore();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'open-history'): void;
  (e: 'switch-model', model: string): void;
}>();

/* ── Context meta ─────────────────────────────────────────────────── */

const title = computed(() => ctx.currentContext?.title || '未提取页面');
const wordCount = computed(() => ctx.currentContext?.wordCount ?? 0);
const faviconUrl = computed(() => {
  const fav = ctx.currentContext?.favicon;
  if (fav) return fav;
  const url = ctx.currentContext?.url;
  if (!url) return null;
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; }
  catch { return null; }
});
const domain = computed(() => {
  try { return new URL(ctx.currentContext?.url || '').hostname; }
  catch { return '—'; }
});

/* ── Model selector ──────────────────────────────────────────────── */

interface ModelOption {
  id: string;
  label: string;
  vendor: string;
  color: string;
  group: 'cloud' | 'local';
}

const MODELS: ModelOption[] = [
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro',  vendor: 'Google',    color: '#248a52', group: 'cloud' },
  { id: 'claude-3.7',     label: 'Claude 3.7',       vendor: 'Anthropic', color: '#ca7a15', group: 'cloud' },
  { id: 'gpt-4o',         label: 'GPT-4o',           vendor: 'OpenAI',    color: '#10a37f', group: 'cloud' },
  { id: 'deepseek-v3',    label: 'DeepSeek V3',      vendor: 'DeepSeek',  color: '#5b60e5', group: 'cloud' },
  { id: 'llama3',         label: 'Llama 3 (Local)',   vendor: 'Ollama',    color: '#ca7a15', group: 'local' },
];

const selectedModelId = ref('gemini-2.5-pro');
const modelDropdownOpen = ref(false);

const selectedModel = computed(() => MODELS.find(m => m.id === selectedModelId.value) ?? MODELS[0]);
const cloudModels = computed(() => MODELS.filter(m => m.group === 'cloud'));
const localModels = computed(() => MODELS.filter(m => m.group === 'local'));

function selectModel(id: string) {
  selectedModelId.value = id;
  modelDropdownOpen.value = false;
  emit('switch-model', id);
}

function toggleDropdown() {
  modelDropdownOpen.value = !modelDropdownOpen.value;
}

function closeDropdown() {
  modelDropdownOpen.value = false;
}

/* ── Favicon fallback ─────────────────────────────────────────────── */
const faviconError = ref(false);
function onFaviconError() { faviconError.value = true; }
</script>

<template>
  <header class="ctx-bar" @keydown.esc="closeDropdown">
    <!-- Left: favicon + title + word count -->
    <div class="ctx-bar__left">
      <div class="ctx-bar__favicon-wrap" aria-hidden="true">
        <img
          v-if="faviconUrl && !faviconError"
          :src="faviconUrl"
          class="ctx-bar__favicon"
          alt=""
          @error="onFaviconError"
        />
        <div v-else class="ctx-bar__favicon-fallback">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect width="18" height="18" rx="4" fill="var(--primary-soft)" />
            <circle cx="9" cy="9" r="5" stroke="var(--primary)" stroke-width="1.5" fill="none" />
            <circle cx="9" cy="9" r="2" fill="var(--primary)" />
          </svg>
        </div>
      </div>

      <div class="ctx-bar__info">
        <div class="ctx-bar__title" :title="ctx.currentContext?.url || ''">
          {{ title }}
        </div>
        <div class="ctx-bar__sub">
          <span v-if="wordCount > 0" class="ctx-bar__badge mono">
            {{ wordCount.toLocaleString() }} 字
          </span>
          <span v-if="domain !== '—'" class="ctx-bar__domain muted">{{ domain }}</span>
        </div>
      </div>
    </div>

    <!-- Right: model selector + extract button -->
    <div class="ctx-bar__right">
      <!-- Model selector dropdown -->
      <div class="ctx-bar__model-wrap" @click.stop>
        <button
          class="ctx-bar__model-btn"
          :aria-expanded="modelDropdownOpen"
          aria-haspopup="listbox"
          title="切换模型"
          @click="toggleDropdown"
        >
          <span
            class="ctx-bar__model-dot"
            :style="{ background: selectedModel.color }"
            aria-hidden="true"
          ></span>
          <span class="ctx-bar__model-name">{{ selectedModel.label }}</span>
          <span class="ctx-bar__model-chevron" :class="{ 'is-open': modelDropdownOpen }" aria-hidden="true">▾</span>
        </button>

        <Transition name="dropdown">
          <div
            v-if="modelDropdownOpen"
            class="ctx-bar__dropdown"
            role="listbox"
            :aria-label="'选择模型，当前：' + selectedModel.label"
          >
            <div class="ctx-bar__dropdown-group">
              <div class="ctx-bar__dropdown-label">云端</div>
              <button
                v-for="m in cloudModels"
                :key="m.id"
                class="ctx-bar__dropdown-item"
                :class="{ 'is-selected': m.id === selectedModelId }"
                role="option"
                :aria-selected="m.id === selectedModelId"
                @click="selectModel(m.id)"
              >
                <span class="ctx-bar__dropdown-dot" :style="{ background: m.color }" aria-hidden="true"></span>
                <span class="ctx-bar__dropdown-text">
                  <span class="ctx-bar__dropdown-name">{{ m.label }}</span>
                  <span class="ctx-bar__dropdown-vendor">{{ m.vendor }}</span>
                </span>
                <span v-if="m.id === selectedModelId" class="ctx-bar__dropdown-check" aria-hidden="true">✓</span>
              </button>
            </div>
            <div v-if="localModels.length" class="ctx-bar__dropdown-group">
              <div class="ctx-bar__dropdown-label">本地</div>
              <button
                v-for="m in localModels"
                :key="m.id"
                class="ctx-bar__dropdown-item"
                :class="{ 'is-selected': m.id === selectedModelId }"
                role="option"
                :aria-selected="m.id === selectedModelId"
                @click="selectModel(m.id)"
              >
                <span class="ctx-bar__dropdown-dot" :style="{ background: m.color }" aria-hidden="true"></span>
                <span class="ctx-bar__dropdown-text">
                  <span class="ctx-bar__dropdown-name">{{ m.label }}</span>
                  <span class="ctx-bar__dropdown-vendor">{{ m.vendor }}</span>
                </span>
                <span v-if="m.id === selectedModelId" class="ctx-bar__dropdown-check" aria-hidden="true">✓</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Extract current tab button -->
      <button
        class="ctx-bar__extract-btn"
        title="提取当前 Tab"
        @click="emit('refresh')"
      >
        ⟳ 提取当前 Tab
      </button>
    </div>
  </header>

  <!-- Click-outside overlay to close dropdown -->
  <div
    v-if="modelDropdownOpen"
    class="ctx-bar__overlay"
    aria-hidden="true"
    @click="closeDropdown"
  ></div>
</template>

<style scoped>
.ctx-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 64px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

/* ── Left ─────────────────────────────────────────────────────────── */
.ctx-bar__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.ctx-bar__favicon-wrap {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--card);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ctx-bar__favicon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.ctx-bar__favicon-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ctx-bar__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ctx-bar__title {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  line-height: 1.3;
}

.ctx-bar__sub {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.ctx-bar__badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--muted);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 1px 7px;
  white-space: nowrap;
}

.ctx-bar__domain {
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

/* ── Right ────────────────────────────────────────────────────────── */
.ctx-bar__right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* Model selector */
.ctx-bar__model-wrap {
  position: relative;
}

.ctx-bar__model-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s, border-color 0.12s;
}

.ctx-bar__model-btn:hover {
  background: var(--primary-soft);
  border-color: #d2d6ff;
}

.ctx-bar__model-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ctx-bar__model-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ctx-bar__model-chevron {
  font-size: 10px;
  color: var(--muted);
  transition: transform 0.15s;
}

.ctx-bar__model-chevron.is-open {
  transform: rotate(180deg);
}

/* Dropdown */
.ctx-bar__dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  padding: 6px;
  z-index: 100;
}

.ctx-bar__dropdown-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ctx-bar__dropdown-group + .ctx-bar__dropdown-group {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.ctx-bar__dropdown-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  padding: 3px 8px;
}

.ctx-bar__dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  font-size: var(--fs-xs);
  color: var(--text);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.ctx-bar__dropdown-item:hover {
  background: var(--card);
}

.ctx-bar__dropdown-item.is-selected {
  background: var(--primary-soft);
  color: var(--primary);
}

.ctx-bar__dropdown-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ctx-bar__dropdown-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.ctx-bar__dropdown-name {
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.ctx-bar__dropdown-vendor {
  font-size: 10px;
  color: var(--muted);
  line-height: 1;
}

.ctx-bar__dropdown-check {
  font-size: 11px;
  color: var(--primary);
  flex-shrink: 0;
}

/* Extract button */
.ctx-bar__extract-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--primary);
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(91, 96, 229, 0.25);
  transition: background 0.12s, box-shadow 0.12s;
}

.ctx-bar__extract-btn:hover {
  background: var(--primary-strong);
  box-shadow: 0 3px 12px rgba(91, 96, 229, 0.35);
}

/* Overlay */
.ctx-bar__overlay {
  position: fixed;
  inset: 0;
  z-index: 9;
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.12s, transform 0.12s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}
</style>
