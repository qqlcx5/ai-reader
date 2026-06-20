<script lang="ts" setup>
import 'virtual:uno.css';
import '@/assets/theme.css';
import { ref, onMounted, computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useTemplatesStore } from '@/stores/templates';
import { useHistoryStore } from '@/stores/history';
import { exportConfig, importConfig } from '@/utils/config-io';
import { formatCost } from '@/utils/cost';
import dayjs from 'dayjs';
import {
  Settings as SettingsIcon,
  Plug,
  FileText,
  Database,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Download,
  Upload,
  Sliders,
  Rss,
} from 'lucide-vue-next';
import ProviderConfig from '@/components/ProviderConfig.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import RSSConfig from '@/components/RSSConfig.vue';
import BaseCard from '@/components/base/BaseCard.vue';
import BaseInput from '@/components/base/BaseInput.vue';
import BaseTextarea from '@/components/base/BaseTextarea.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseIconButton from '@/components/base/BaseIconButton.vue';
import BaseState from '@/components/base/BaseState.vue';
import { PROVIDER_META } from '@/utils/providers';

const settings = useSettingsStore();
const templates = useTemplatesStore();
const history = useHistoryStore();

type Section = 'general' | 'providers' | 'templates' | 'data' | 'rss';
const activeSection = ref<Section>('providers');

const providerIds = computed(() => Object.keys(PROVIDER_META));

// --- Templates ---
const editingId = ref<string | null>(null);
const editingName = ref('');
const editingPrompt = ref('');
const newName = ref('');
const newPrompt = ref('');
const showAddForm = ref(false);

function startEdit(id: string, name: string, prompt: string) {
  editingId.value = id;
  editingName.value = name;
  editingPrompt.value = prompt;
}
function saveEdit() {
  if (!editingId.value) return;
  templates.updateTemplate(editingId.value, { name: editingName.value, prompt: editingPrompt.value });
  editingId.value = null;
}
function cancelEdit() { editingId.value = null; }
function addTemplate() {
  if (!newName.value.trim() || !newPrompt.value.trim()) return;
  templates.addTemplate(newName.value.trim(), newPrompt.value.trim());
  newName.value = ''; newPrompt.value = '';
  showAddForm.value = false;
}

// --- Data ---
function handleExport() {
  const providerSettings = {
    providers: settings.providers,
    enabledProviders: settings.enabledProviders,
  };
  const json = exportConfig(providerSettings, templates.templates);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-reader-config-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const fileInput = ref<HTMLInputElement | null>(null);
function handleImportClick() { fileInput.value?.click(); }
function handleImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const result = importConfig(reader.result as string);
    if (!result) {
      alert('配置文件无效');
      return;
    }
    for (const [id, cfg] of Object.entries(result.providers)) {
      if (settings.providers[id]) {
        settings.updateProvider(id, { baseUrl: cfg.baseUrl, model: cfg.model });
      }
    }
    if (result.templates.length > 0) {
      for (const t of result.templates) {
        templates.addTemplate(t.name, t.prompt);
      }
    }
  };
  reader.readAsText(file);
  target.value = '';
}

function clearAllHistory() {
  if (confirm('确定清空所有历史记录吗？此操作不可撤销。')) {
    history.clear();
  }
}

const navItems: { id: Section; label: string; icon: any }[] = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'providers', label: 'Providers', icon: Plug },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'rss', label: 'RSS', icon: Rss },
  { id: 'data', label: 'Data', icon: Database },
];

const enabledCount = computed(() => settings.enabledProviders.length);
const totalResponses = computed(() =>
  history.entries.reduce((sum, e) => sum + e.responses.length, 0)
);

onMounted(() => {
  settings.load();
  templates.load();
  history.load();
});
</script>

<template>
  <div class="min-h-screen bg-[var(--background-primary)] text-[var(--text-normal)]">
    <!-- Top bar -->
    <header class="sticky top-0 z-20 flex items-center justify-between px-6 h-12 border-b border-[var(--background-modifier-border)] bg-[var(--background-primary)] shadow-sm">
      <div class="flex items-center gap-2.5">
        <SettingsIcon class="w-4 h-4 text-[var(--text-muted)]" />
        <h1 class="text-[var(--font-ui-medium)] font-semibold text-[var(--text-normal)]">AI Reader Settings</h1>
      </div>
      <ThemeToggle />
    </header>

    <div class="flex" style="min-height: calc(100vh - 3rem)">
      <!-- Sidebar nav -->
      <nav
        class="w-[240px] shrink-0 border-r border-[var(--background-modifier-border)] bg-[var(--background-primary)] py-4"
        aria-label="Settings sections"
      >
        <ul class="nav-list px-2">
          <li v-for="item in navItems" :key="item.id">
            <button
              type="button"
              :class="activeSection === item.id ? 'nav-item-active !text-[var(--text-accent)] !bg-[var(--color-accent-soft)]' : 'nav-item'"
              @click="activeSection = item.id"
            >
              <component :is="item.icon" class="w-4 h-4" />
              <span class="flex-1 text-left">{{ item.label }}</span>
            </button>
          </li>
        </ul>
      </nav>

      <!-- Content -->
      <main class="flex-1 px-8 py-6 max-w-3xl scrollbar-thin">
        <!-- GENERAL -->
        <section v-show="activeSection === 'general'" class="space-y-6">
          <header class="section-header">
            <div>
              <h2 class="section-title">General</h2>
              <p class="section-subtitle">全局行为与外观</p>
            </div>
          </header>

          <div class="setting-items">
            <div class="setting-item-mod-horizontal">
              <div class="setting-item-info">
                <div class="setting-item-label">主题</div>
                <div class="setting-item-description">点击右上角图标在浅色 / 深色 / 跟随系统之间切换</div>
              </div>
              <div class="setting-item-control">
                <ThemeToggle />
              </div>
            </div>
            <div class="setting-item-mod-horizontal">
              <div class="setting-item-info">
                <div class="setting-item-label">已启用 Provider</div>
                <div class="setting-item-description">当前在 Side Panel 中并排运行的模型数量</div>
              </div>
              <div class="setting-item-control">
                <span class="pill-accent">{{ enabledCount }} 个</span>
              </div>
            </div>
            <div class="setting-item-mod-horizontal">
              <div class="setting-item-info">
                <div class="setting-item-label">历史记录条数</div>
                <div class="setting-item-description">最近保存的对话快照，最多 50 条</div>
              </div>
              <div class="setting-item-control">
                <span class="pill-neutral">{{ history.entries.length }} 条</span>
              </div>
            </div>
            <div class="setting-item-mod-horizontal">
              <div class="setting-item-info">
                <div class="setting-item-label">累计回答数</div>
                <div class="setting-item-description">所有历史记录中的模型回答总数</div>
              </div>
              <div class="setting-item-control">
                <span class="pill-neutral">{{ totalResponses }} 次</span>
              </div>
            </div>
            <div class="setting-item-mod-horizontal">
              <div class="setting-item-info">
                <div class="setting-item-label">累计花费</div>
                <div class="setting-item-description">所有历史记录中的 token 估算花费</div>
              </div>
              <div class="setting-item-control">
                <span class="pill-success">{{ formatCost(history.totalCost) }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- PROVIDERS -->
        <section v-show="activeSection === 'providers'" class="space-y-6">
          <header class="section-header">
            <div>
              <h2 class="section-title">Providers</h2>
              <p class="section-subtitle">配置 AI 模型供应商。点击右侧开关启用。</p>
            </div>
          </header>

          <div class="setting-items" role="list">
            <ProviderConfig
              v-for="id in providerIds"
              :key="id"
              :provider-id="id"
            />
          </div>
        </section>

        <!-- TEMPLATES -->
        <section v-show="activeSection === 'templates'" class="space-y-6">
          <header class="section-header">
            <div>
              <h2 class="section-title">Prompt Templates</h2>
              <p class="section-subtitle">在 Side Panel 中可一键触发的提示词模板</p>
            </div>
            <BaseButton variant="primary" size="sm" aria-label="添加模板" @click="showAddForm = !showAddForm">
              <template #icon-left><Plus class="w-3.5 h-3.5" /></template>
              New Template
            </BaseButton>
          </header>

          <!-- Add form -->
          <div v-if="showAddForm" class="setting-items">
            <div class="p-4 space-y-3">
              <BaseInput
                v-model="newName"
                label="Name"
                placeholder="e.g. 中英对照翻译"
                aria-label="新模板名称"
              />
              <BaseTextarea
                v-model="newPrompt"
                label="Prompt"
                placeholder="翻译以下文章到中英对照..."
                :rows="4"
                aria-label="新模板提示词"
              />
              <div class="flex gap-2">
                <BaseButton variant="primary" size="sm" @click="addTemplate">
                  <template #icon-left><Check class="w-3.5 h-3.5" /></template>
                  Add
                </BaseButton>
                <BaseButton variant="secondary" size="sm" @click="showAddForm = false; newName = ''; newPrompt = ''">
                  <template #icon-left><X class="w-3.5 h-3.5" /></template>
                  Cancel
                </BaseButton>
              </div>
            </div>
          </div>

          <div class="setting-items" role="list">
            <div
              v-for="t in templates.templates"
              :key="t.id"
              class="setting-item"
            >
              <div v-if="editingId === t.id" class="flex-1 min-w-0 space-y-2">
                <BaseInput v-model="editingName" :aria-label="`编辑 ${t.name} 名称`" />
                <BaseTextarea v-model="editingPrompt" :rows="3" :aria-label="`编辑 ${t.name} 提示词`" />
                <div class="flex gap-2">
                  <BaseButton variant="primary" size="sm" @click="saveEdit">
                    <template #icon-left><Check class="w-3.5 h-3.5" /></template>
                    Save
                  </BaseButton>
                  <BaseButton variant="secondary" size="sm" @click="cancelEdit">
                    <template #icon-left><X class="w-3.5 h-3.5" /></template>
                    Cancel
                  </BaseButton>
                </div>
              </div>
              <div v-else class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-[var(--text-normal)]">{{ t.name }}</span>
                  <span v-if="t.isDefault" class="pill-accent">Default</span>
                </div>
                <p class="mt-1 text-[var(--font-ui-smaller)] text-[var(--text-muted)] line-clamp-2">{{ t.prompt }}</p>
              </div>
              <div v-if="editingId !== t.id" class="flex items-center gap-1 shrink-0">
                <BaseIconButton size="sm" variant="primary" aria-label="Edit template" @click="startEdit(t.id, t.name, t.prompt)">
                  <Pencil class="w-3.5 h-3.5" />
                </BaseIconButton>
                <BaseIconButton
                  v-if="!t.isDefault"
                  size="sm"
                  variant="danger"
                  aria-label="Delete template"
                  @click="templates.removeTemplate(t.id)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </BaseIconButton>
              </div>
            </div>
          </div>
        </section>

        <!-- RSS -->
        <section v-show="activeSection === 'rss'">
          <RSSConfig />
        </section>

        <!-- DATA -->
        <section v-show="activeSection === 'data'" class="space-y-6">
          <header class="section-header">
            <div>
              <h2 class="section-title">Data</h2>
              <p class="section-subtitle">导入导出配置，管理历史记录</p>
            </div>
          </header>

          <div class="setting-items">
            <div class="setting-item">
              <div class="setting-item-info">
                <div class="setting-item-label">导出配置</div>
                <div class="setting-item-description">导出当前设置到 JSON 文件。API Key 出于安全考虑不会包含在导出中。</div>
              </div>
              <div class="setting-item-control">
                <BaseButton variant="primary" size="sm" aria-label="Export configuration" @click="handleExport">
                  <template #icon-left><Download class="w-4 h-4" /></template>
                  Export
                </BaseButton>
              </div>
            </div>
            <div class="setting-item">
              <div class="setting-item-info">
                <div class="setting-item-label">导入配置</div>
                <div class="setting-item-description">从之前导出的 JSON 文件恢复设置</div>
              </div>
              <div class="setting-item-control">
                <BaseButton variant="secondary" size="sm" aria-label="Import configuration" @click="handleImportClick">
                  <template #icon-left><Upload class="w-4 h-4" /></template>
                  Import
                </BaseButton>
                <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleImport" />
              </div>
            </div>
            <div class="setting-item">
              <div class="setting-item-info">
                <div class="setting-item-label text-[var(--text-error)]">清空历史记录</div>
                <div class="setting-item-description">删除所有已保存的对话历史，此操作不可撤销</div>
              </div>
              <div class="setting-item-control">
                <BaseButton variant="danger" size="sm" aria-label="Clear all history" :disabled="history.entries.length === 0" @click="clearAllHistory">
                  <template #icon-left><Trash2 class="w-4 h-4" /></template>
                  Clear
                </BaseButton>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
