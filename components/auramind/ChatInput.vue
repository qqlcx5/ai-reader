<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { BookTemplate, Cpu, Paperclip, Pencil, Plus, Send, Square, Trash2, X, List, Play } from '@lucide/vue'
import { useChatStore } from '@/stores/chat.store'
import { useModelStore } from '@/stores/model.store'
import { useDocumentStore } from '@/stores/document.store'
import { useSettingsStore } from '@/stores/settings.store'
import { usePromptTemplateStore } from '@/stores/prompt-template.store'
import ModelSelect from '@/components/workspace/ModelSelect.vue'
import UButton from '@/components/ui/UButton.vue'
import UTextarea from '@/components/ui/UTextarea.vue'


const chatStore = useChatStore()
const modelStore = useModelStore()
const documentStore = useDocumentStore()
const settingsStore = useSettingsStore()
const promptTemplateStore = usePromptTemplateStore()

// ── Template popover ─────────────────────────────────────
const showTemplatePanel = ref(false)
const showQueuePanel = ref(false)
const showTemplateManager = ref(false)
const newTemplateTitle = ref('')
const newTemplateContent = ref('')
const editingTemplateId = ref<string | null>(null)
const editTemplateTitle = ref('')
const editTemplateContent = ref('')
const templateDirectSend = ref(true)

function toggleTemplatePanel() {
  showTemplatePanel.value = !showTemplatePanel.value
  showTemplateManager.value = false
  if (showTemplatePanel.value) {
    promptTemplateStore.initTemplates()
  }
}

function applyTemplate(content: string) {
  if (templateDirectSend.value) {
    chatStore.setInputText(content)
    showTemplatePanel.value = false
    showTemplateManager.value = false
    submit()
    return
  }
  const current = chatStore.inputText.trim()
  if (current) {
    chatStore.setInputText(current + '\n\n' + content)
  } else {
    chatStore.setInputText(content)
  }
  showTemplatePanel.value = false
  showTemplateManager.value = false
}

async function handleAddTemplate() {
  const title = newTemplateTitle.value.trim()
  const content = newTemplateContent.value.trim()
  if (!title || !content) return
  await promptTemplateStore.addTemplate(title, content, '自定义')
  newTemplateTitle.value = ''
  newTemplateContent.value = ''
}

async function handleDeleteTemplate(id: string) {
  await promptTemplateStore.deleteTemplate(id)
}

function startEditTemplate(t: { id: string; title: string; content: string }) {
  editingTemplateId.value = t.id
  editTemplateTitle.value = t.title
  editTemplateContent.value = t.content
}

function cancelEditTemplate() {
  editingTemplateId.value = null
  editTemplateTitle.value = ''
  editTemplateContent.value = ''
}

async function handleUpdateTemplate(id: string) {
  const title = editTemplateTitle.value.trim()
  const content = editTemplateContent.value.trim()
  if (!title || !content) return
  await promptTemplateStore.updateTemplate(id, { title, content })
  cancelEditTemplate()
}

const contextDoc = computed(() =>
  documentStore.pageDocument || documentStore.currentDocument,
)

const hasContext = computed(() => !!contextDoc.value?.markdown)

const contextLabel = computed(() => {
  if (contextDoc.value) return '当前网页'
  return '无上下文'
})

// includeContext is owned by the chat store (default true). When the user
// toggles it off, the next message is sent without the page markdown.
function toggleIncludeContext() {
  chatStore.setIncludeContext(!chatStore.includeContext)
}

// ── Model selection (single / multi) ─────────────────────
const multiModelIds = ref<string[]>([...modelStore.selectedModelIds])

// Sync if store changes externally
watch(
  () => modelStore.selectedModelIds,
  (ids) => { multiModelIds.value = [...ids] },
)

const isMultiModel = computed(() => multiModelIds.value.length > 1)
const multiCount = computed(() => multiModelIds.value.length)

const sendLabel = computed(() => {
  if (isMultiModel.value) return `广播 ${multiCount.value} 个模型`
  return ''
})

// ── canSend for multi-model: at least 1 model selected ───
const canSendMulti = computed(() => {
  const msg = chatStore.inputText.trim()
  if (!msg && !chatStore.canSendEmpty) return false
  if (multiModelIds.value.length === 0) return false
  if (chatStore.isSending || chatStore.isStreaming) return !!msg

  // Single-model: delegate to store canSend (handleModelChange already
  // keeps multiModelIds and modelStore.currentModelId in sync).
  if (multiModelIds.value.length === 1) {
    return chatStore.canSend
  }

  // Multi-model: check each selected model is valid
  for (const id of multiModelIds.value) {
    const m = modelStore.models.find((mod) => mod.id === id)
    if (!m || !m.enabled) return false
  }
  return true
})

function handleModelChange(value: string | string[]) {
  if (Array.isArray(value)) {
    multiModelIds.value = value
    modelStore.setSelectedModelIds(value)
  } else {
    multiModelIds.value = [value]
    modelStore.selectModel(value)
  }
}

function submit() {
  const msg = chatStore.inputText.trim()
  if (!msg && !chatStore.canSendEmpty) return
  if (!canSendMulti.value) return

  chatStore.clearError()

  const modelIds = multiModelIds.value.length > 0
    ? multiModelIds.value
    : modelStore.currentModelId ? [modelStore.currentModelId] : []

  if (chatStore.isSending || chatStore.isStreaming) {
    chatStore.enqueueMessage(msg, modelIds)
  } else {
    chatStore.sendMessage(msg, modelIds).catch((e: Error) => {
      chatStore.lastError = e.message || '发送失败，请重试'
    })
  }
  chatStore.setInputText('')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function handleStop() {
  chatStore.stopGeneration()
}
</script>

<template>
  <div class="absolute left-0 right-0 bottom-0 p-3 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent z-20">
    <!-- Template popover panel -->
    <div
      v-if="showTemplatePanel"
      class="absolute bottom-full left-3 mb-2 w-72 max-h-80 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden z-30 flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-100 shrink-0">
        <span class="text-[12px] font-semibold text-zinc-700">提示词模板</span>
        <div class="flex items-center gap-1.5">
          <button
            class="text-[10px] px-1.5 py-0.5 rounded border text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 transition-colors"
            :class="templateDirectSend ? 'bg-brand/10 border-brand/20 text-brand' : 'border-zinc-200'"
            @click="templateDirectSend = !templateDirectSend"
          >
            {{ templateDirectSend ? '立即发送' : '二次编辑' }}
          </button>
          <UButton variant="ghost" size="sm" class="p-0.5" @click="showTemplatePanel = false">
            <X class="w-3.5 h-3.5" />
          </UButton>
        </div>
      </div>

      <!-- Template list -->
      <div v-if="!showTemplateManager" class="flex-1 overflow-y-auto px-1 py-1">
        <div
          v-for="t in promptTemplateStore.templates"
          :key="t.id"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 cursor-pointer group"
          @click="applyTemplate(t.content)"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
          <span class="text-[12px] text-zinc-700 flex-1 truncate">{{ t.title }}</span>
        </div>

        <!-- Empty state -->
        <div
          v-if="promptTemplateStore.templates.length === 0"
          class="text-[11px] text-zinc-400 text-center py-4"
        >
          暂无模板
        </div>
      </div>

      <!-- Template manager -->
      <div v-else class="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        <!-- Add form -->
        <div class="space-y-2">
          <input
            v-model="newTemplateTitle"
            type="text"
            placeholder="模板标题"
            class="w-full text-[12px] px-2 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition-all"
          />
          <textarea
            v-model="newTemplateContent"
            placeholder="模板内容"
            rows="3"
            class="w-full text-[12px] px-2 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition-all resize-none"
          />
          <UButton
            variant="primary"
            size="sm"
            class="w-full text-[11px]"
            :disabled="!newTemplateTitle.trim() || !newTemplateContent.trim()"
            @click="handleAddTemplate"
          >
            <Plus class="w-3 h-3" />
            添加模板
          </UButton>
        </div>

        <!-- Template list with edit/delete -->
        <div v-if="promptTemplateStore.templates.length > 0">
          <div class="text-[10px] text-zinc-400 font-medium mb-1">管理模板</div>
          <div
            v-for="t in promptTemplateStore.templates"
            :key="t.id"
            class="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-zinc-50"
          >
            <!-- Non-editing state -->
            <template v-if="editingTemplateId !== t.id">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                <span class="text-[12px] text-zinc-700 truncate">{{ t.title }}</span>
              </div>
              <div class="flex items-center gap-0.5 shrink-0">
                <UButton
                  variant="ghost"
                  size="sm"
                  class="p-0.5 text-zinc-400 hover:text-brand"
                  @click="startEditTemplate(t)"
                >
                  <Pencil class="w-3 h-3" />
                </UButton>
                <UButton
                  variant="ghost"
                  size="sm"
                  class="p-0.5 text-zinc-400 hover:text-red-500"
                  @click="handleDeleteTemplate(t.id)"
                >
                  <Trash2 class="w-3 h-3" />
                </UButton>
              </div>
            </template>
            <!-- Editing state -->
            <template v-else>
              <div class="flex-1 space-y-1.5">
                <input
                  v-model="editTemplateTitle"
                  type="text"
                  class="w-full text-[11px] px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-50 outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition-all"
                />
                <textarea
                  v-model="editTemplateContent"
                  rows="2"
                  class="w-full text-[11px] px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-50 outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition-all resize-none"
                />
                <div class="flex items-center gap-1">
                  <UButton
                    variant="primary"
                    size="sm"
                    class="text-[10px] py-0.5 px-2"
                    :disabled="!editTemplateTitle.trim() || !editTemplateContent.trim()"
                    @click="handleUpdateTemplate(t.id)"
                  >
                    保存
                  </UButton>
                  <UButton
                    variant="ghost"
                    size="sm"
                    class="text-[10px] py-0.5 px-2 text-zinc-400"
                    @click="cancelEditTemplate"
                  >
                    取消
                  </UButton>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-zinc-100 px-3 py-2 shrink-0">
        <UButton
          variant="ghost"
          size="sm"
          class="w-full text-[11px] text-zinc-500"
          @click="showTemplateManager = !showTemplateManager"
        >
          {{ showTemplateManager ? '返回模板列表' : '管理模板' }}
        </UButton>
      </div>
    </div>

    <div
      v-if="showQueuePanel && chatStore.steeringQueue.length > 0"
      class="absolute bottom-full right-3 mb-2 w-72 max-h-64 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden z-30"
    >
      <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-100">
        <span class="text-[12px] font-semibold text-zinc-700">待处理消息 {{ chatStore.steeringQueue.length }}</span>
        <button class="text-zinc-400 hover:text-zinc-700" title="关闭队列" @click="showQueuePanel = false"><X class="w-3.5 h-3.5" /></button>
      </div>
      <div class="max-h-48 overflow-y-auto p-1">
        <div v-for="item in chatStore.steeringQueue" :key="item.id" class="flex items-start gap-2 px-2 py-2 text-[12px] hover:bg-zinc-50">
          <span class="flex-1 min-w-0 break-words text-zinc-700">{{ item.content }}</span>
          <button class="shrink-0 text-zinc-400 hover:text-red-500" title="移除排队消息" @click="chatStore.removeQueuedMessage(item.id)"><X class="w-3 h-3" /></button>
        </div>
      </div>
      <button
        v-if="chatStore.queuePaused"
        class="w-full flex items-center justify-center gap-1 border-t border-zinc-100 py-2 text-[11px] text-brand hover:bg-brand/5"
        @click="chatStore.resumeQueue()"
      ><Play class="w-3 h-3" />继续处理队列</button>
    </div>

    <div class="bg-white border border-zinc-200 rounded-2xl shadow-lg overflow-hidden">
      <div class="flex items-center justify-between px-3 pt-2">
        <div class="flex items-center gap-1">
          <!-- Template button -->
          <UButton
            variant="ghost"
            size="sm"
            class="p-1.5"
            @click="toggleTemplatePanel"
          >
            <BookTemplate class="w-3.5 h-3.5 text-zinc-500" />
          </UButton>
          <div class="w-px h-5 bg-zinc-200" />

          <ModelSelect
            v-if="modelStore.models.length > 0"
            :model-value="multiModelIds"
            :models="modelStore.models"
            :multiple="true"
            @update:model-value="handleModelChange"
          />
          <UButton v-else variant="ghost" size="sm" class="text-[11px] text-zinc-400">
            <Cpu class="w-3 h-3" />
            No model
          </UButton>
        </div>

        <div class="flex items-center gap-1">
          <button
            v-if="chatStore.steeringQueue.length > 0"
            class="flex items-center gap-1 px-1.5 py-0.5 rounded border border-brand/20 bg-brand/5 text-brand text-[11px]"
            :title="chatStore.queuePaused ? '队列已暂停' : '查看待处理消息'"
            @click="showQueuePanel = !showQueuePanel"
          ><List class="w-3 h-3" />{{ chatStore.steeringQueue.length }}</button>
        </div>

        <div
          class="flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded border transition-colors"
          :class="hasContext
            ? (chatStore.includeContext
              ? 'bg-brand/10 border-brand/30 text-brand cursor-pointer'
              : 'bg-zinc-50 border-zinc-200 text-zinc-400 cursor-pointer hover:text-zinc-600 hover:border-zinc-300')
            : 'bg-zinc-50 border-zinc-200 text-zinc-300 cursor-not-allowed'"
          :title="hasContext
            ? (chatStore.includeContext ? '点击取消挂载上下文（默认已挂载）' : '点击挂载上下文')
            : '暂无上下文可挂载'"
          role="button"
          :aria-pressed="hasContext && chatStore.includeContext"
          :aria-disabled="!hasContext"
          @click="hasContext && toggleIncludeContext()"
        >
          <Paperclip class="w-3 h-3" />
          <span>{{ contextLabel }}</span>
        </div>
      </div>

      <div class="relative">
        <!-- Error banner -->
        <div
          v-if="chatStore.lastError"
          class="mx-3 mb-1 px-2.5 py-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg"
        >
          {{ chatStore.lastError }}
        </div>
        <UTextarea
          :model-value="chatStore.inputText"
          :rows="1"
          auto-height
          class="w-full bg-transparent text-[13px] px-3 py-2.5 pr-11 placeholder:text-zinc-400 min-h-[42px] focus:border-transparent"
          placeholder="基于当前网页继续提问..."
          @update:model-value="chatStore.setInputText($event)"
          @keydown="handleKeydown"
        />
        <!-- Send or enqueue button -->
        <UButton
          variant="primary"
          class="absolute right-10 bottom-2 p-1.5 !rounded-lg"
          :disabled="!canSendMulti"
          :title="chatStore.isStreaming || chatStore.isSending ? '加入生成队列' : '发送消息'"
          @click="submit"
        >
          <List v-if="chatStore.isStreaming || chatStore.isSending" class="w-3.5 h-3.5" />
          <Send v-else class="w-3.5 h-3.5" />
          <span v-if="sendLabel && !chatStore.isStreaming && !chatStore.isSending" class="ml-1 text-[11px]">{{ sendLabel }}</span>
        </UButton>
        <!-- Stop button during streaming -->
        <UButton
          v-if="chatStore.isStreaming"
          variant="ghost"
          class="absolute right-2 bottom-2 p-1.5 !rounded-lg text-red-500"
          title="停止生成"
          @click="handleStop"
        >
          <Square class="w-3.5 h-3.5" />
        </UButton>
      </div>
    </div>
  </div>
</template>
