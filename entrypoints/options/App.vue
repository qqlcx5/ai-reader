<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useTemplatesStore } from '@/stores/templates';
import ProviderConfig from '@/components/ProviderConfig.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import { PROVIDERS } from '@/utils/llm';
import { exportConfig, importConfig } from '@/utils/config-io';
import { Settings, Plus, Pencil, Trash2, Check, X, Download, Upload } from 'lucide-vue-next';

const settings = useSettingsStore();
const templates = useTemplatesStore();

const providerList = Object.entries(PROVIDERS).map(([id, p]) => ({
  id,
  name: p.name,
}));

// Template editing state
const editingId = ref<string | null>(null);
const editingName = ref('');
const editingPrompt = ref('');

// New template form
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
  templates.updateTemplate(editingId.value, {
    name: editingName.value,
    prompt: editingPrompt.value,
  });
  editingId.value = null;
}

function cancelEdit() {
  editingId.value = null;
}

function addTemplate() {
  if (!newName.value.trim() || !newPrompt.value.trim()) return;
  templates.addTemplate(newName.value.trim(), newPrompt.value.trim());
  newName.value = '';
  newPrompt.value = '';
  showAddForm.value = false;
}

// Data management
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

function handleImportClick() {
  fileInput.value?.click();
}

function handleImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const result = importConfig(reader.result as string);
    if (!result) {
      alert('Invalid config file');
      return;
    }
    // Apply imported data (merging into existing settings)
    for (const [id, cfg] of Object.entries(result.providers)) {
      if (settings.providers[id]) {
        settings.providers[id].baseUrl = cfg.baseUrl;
        settings.providers[id].model = cfg.model;
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

onMounted(() => {
  settings.load();
  templates.load();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 transition-colors">
    <div class="max-w-3xl mx-auto px-4">
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3">
          <Settings class="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Reader Settings</h1>
        </div>
        <ThemeToggle />
      </div>

      <div class="space-y-6">
        <!-- Provider configs -->
        <div v-for="provider in providerList" :key="provider.id">
          <ProviderConfig
            :provider-id="provider.id"
            :provider-name="provider.name"
          />
        </div>

        <!-- Template Manager -->
        <section class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Prompt Templates</h2>
            <button
              @click="showAddForm = !showAddForm"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              <Plus class="w-4 h-4" />
              Add Template
            </button>
          </div>

          <!-- Add form -->
          <div v-if="showAddForm" class="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <input
              v-model="newName"
              type="text"
              placeholder="Template name"
              class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              v-model="newPrompt"
              placeholder="Prompt content"
              rows="4"
              class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            <div class="flex gap-2">
              <button
                @click="addTemplate"
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
              >
                <Check class="w-4 h-4" />
                Add
              </button>
              <button
                @click="showAddForm = false; newName = ''; newPrompt = ''"
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                <X class="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>

          <!-- Template list -->
          <div class="space-y-2">
            <div
              v-for="t in templates.templates"
              :key="t.id"
              class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <!-- Editing mode -->
              <div v-if="editingId === t.id" class="space-y-2">
                <input
                  v-model="editingName"
                  type="text"
                  class="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  v-model="editingPrompt"
                  rows="3"
                  class="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
                <div class="flex gap-2">
                  <button
                    @click="saveEdit"
                    class="flex items-center gap-1 px-2.5 py-1 text-sm bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                  >
                    <Check class="w-3.5 h-3.5" />
                    Save
                  </button>
                  <button
                    @click="cancelEdit"
                    class="flex items-center gap-1 px-2.5 py-1 text-sm bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                  >
                    <X class="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Display mode -->
              <div v-else class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900 dark:text-gray-100">{{ t.name }}</span>
                    <span v-if="t.isDefault" class="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">Default</span>
                  </div>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">{{ t.prompt }}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    @click="startEdit(t.id, t.name, t.prompt)"
                    class="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    aria-label="Edit template"
                  >
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button
                    v-if="!t.isDefault"
                    @click="templates.removeTemplate(t.id)"
                    class="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    aria-label="Delete template"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Data Management -->
        <section class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Data Management</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Export or import your provider settings and custom templates. API keys are never exported.
          </p>
          <div class="flex gap-3">
            <button
              @click="handleExport"
              class="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              aria-label="Export configuration"
            >
              <Download class="w-4 h-4" />
              Export Config
            </button>
            <button
              @click="handleImportClick"
              class="flex items-center gap-2 px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              aria-label="Import configuration"
            >
              <Upload class="w-4 h-4" />
              Import Config
            </button>
            <input
              ref="fileInput"
              type="file"
              accept=".json"
              class="hidden"
              @change="handleImport"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
