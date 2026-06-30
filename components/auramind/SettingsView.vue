<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { SlidersHorizontal, Plus, RefreshCw } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UTextarea from '@/components/ui/UTextarea.vue'
import ModelCard from './ModelCard.vue'
import ModelEditorDialog from './ModelEditorDialog.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import ContextSettings from '@/components/settings/ContextSettings.vue'
import CaptureSettings from '@/components/settings/CaptureSettings.vue'
import StorageSettings from '@/components/settings/StorageSettings.vue'
import WebDAVSettings from '@/components/settings/WebDAVSettings.vue'
import { useModelStore } from '@/stores/model.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useAppStore } from '@/stores/app.store'

const modelStore = useModelStore()
const settingsStore = useSettingsStore()
const appStore = useAppStore()

const enabledCount = computed(() => modelStore.models.filter(m => m.enabled).length)

const showEditor = ref(false)
const editModelId = ref<string | undefined>(undefined)
const showDeleteConfirm = ref(false)
const deleteTargetId = ref<string | undefined>(undefined)
const deleteTargetName = ref('')
const showDefaultBlocked = ref(false)

const globalSystemPrompt = computed({
  get: () => settingsStore.settings.globalSystemPrompt || '',
  set: (val: string) => settingsStore.updateGlobalSystemPrompt(val),
})

onMounted(async () => {
  await modelStore.loadModels()
  await settingsStore.loadSettings()
})

function openAddDialog() {
  editModelId.value = undefined
  showEditor.value = true
}

function openEditDialog(id: string) {
  editModelId.value = id
  showEditor.value = true
}

function closeEditor() {
  showEditor.value = false
  editModelId.value = undefined
}

function requestDelete(id: string) {
  const model = modelStore.models.find(m => m.id === id)
  if (!model) return

  if (model.isDefault) {
    showDefaultBlocked.value = true
    return
  }

  deleteTargetId.value = id
  deleteTargetName.value = model.name
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!deleteTargetId.value) return
  await modelStore.deleteModel(deleteTargetId.value)
  showDeleteConfirm.value = false
  deleteTargetId.value = undefined
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deleteTargetId.value = undefined
}

async function testModelConnection(id: string) {
  const success = await modelStore.testConnection(id)
  const model = modelStore.models.find(m => m.id === id)
  if (!model) return

  if (success) {
    appStore.showToast(`Ping 成功${model.lastTestLatency ? `（${model.lastTestLatency}ms）` : ''}`, 'success')
    return
  }

  appStore.showToast(model.lastTestError ? `Ping 失败：${model.lastTestError}` : 'Ping 失败', 'error')
}

async function duplicateModel(id: string) {
  const duplicated = await modelStore.duplicateModel(id)
  if (!duplicated) {
    appStore.showToast('复制模型失败', 'error')
    return
  }

  appStore.showToast(`已复制模型：${duplicated.name}`, 'success')
}

async function handleToggleEnabled(id: string, enabled: boolean) {
  const result = await modelStore.toggleEnabled(id, enabled)
  if (result.success) {
    return
  }

  switch (result.reason) {
    case 'default-model':
      appStore.showToast('默认模型不能直接禁用，请先将其他模型设为默认', 'error')
      break
    case 'last-enabled':
      appStore.showToast('至少需要保留一个启用中的模型', 'error')
      break
    default:
      appStore.showToast('切换模型状态失败', 'error')
  }
}
</script>

<template>
  <div class="flex-1 min-h-0 flex-col bg-[#F4F4F5] flex">
    <!-- Header -->
    <div class="h-12 shrink-0 px-4 flex items-center justify-between border-b border-zinc-200/70 bg-[#F4F4F5]/90 backdrop-blur-md">
      <div class="text-[14px] font-semibold flex items-center gap-2">
        <SlidersHorizontal class="w-4 h-4 text-brand" />
        核心配置
      </div>
      <UButton variant="link" size="sm">保存</UButton>
    </div>

    <main class="flex-1 min-h-0 overflow-y-auto px-4 py-5 flex flex-col gap-7">
      <!-- AI 模型池 -->
      <section class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between pl-1">
          <h2 class="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider">AI 模型池</h2>
          <span class="text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded">{{ enabledCount }} 启用</span>
        </div>

        <div class="flex flex-col gap-2">
          <ModelCard
            v-for="model in modelStore.models"
            :key="model.id"
            :model="model"
            @duplicate="duplicateModel"
            @toggle-enabled="handleToggleEnabled"
            @ping="testModelConnection"
            @edit="openEditDialog"
            @delete="requestDelete"
          />

          <UButton variant="dashed" size="lg" class="w-full" @click="openAddDialog">
            <Plus class="w-3.5 h-3.5" />
            添加模型节点
          </UButton>
        </div>
      </section>

      <!-- 上下文与系统指令 -->
      <section class="flex flex-col gap-2.5">
        <h2 class="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">上下文与系统指令</h2>

        <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
          <div class="p-3 flex flex-col gap-1.5">
            <span class="text-zinc-700">全局系统指令</span>
            <UTextarea
              v-model="globalSystemPrompt"
              :rows="4"
              class="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-[11px] text-zinc-600 focus:border-brand font-mono"
            />
          </div>
        </div>

        <ContextSettings />
        <CaptureSettings />
      </section>

      <!-- WebDAV 同步 -->
      <section class="flex flex-col gap-2.5">
        <h2 class="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">WebDAV 同步</h2>
        <WebDAVSettings />
      </section>

      <!-- 本地存储 -->
      <section class="flex flex-col gap-2.5 pb-8">
        <h2 class="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">本地存储</h2>
        <StorageSettings />
      </section>
    </main>

    <!-- Model Editor Dialog -->
    <ModelEditorDialog
      :open="showEditor"
      :model-id="editModelId"
      @close="closeEditor"
      @saved="closeEditor"
    />

    <!-- Delete Confirm -->
    <ConfirmModal
      v-if="showDeleteConfirm"
      title="删除模型"
      :desc="`确定删除模型「${deleteTargetName}」吗？此操作不可撤销。`"
      confirm-text="删除"
      danger
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <!-- Default Model Blocked Alert -->
    <ConfirmModal
      v-if="showDefaultBlocked"
      title="无法删除默认模型"
      desc="这是当前默认模型，请先将其他模型设为默认后再删除。"
      confirm-text="知道了"
      @confirm="showDefaultBlocked = false"
      @cancel="showDefaultBlocked = false"
    />
  </div>
</template>
