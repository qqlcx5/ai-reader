<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import {
  Sparkles, ChevronDown, Play, Square, Copy, Send, Trash2,
} from '@lucide/vue'
import { useChat } from '../composables/useChat'
import { useToast } from '../composables/useToast'
import { useCaptureStore } from '@/stores/capture'

const toast = useToast()
const captureStore = useCaptureStore()
const {
  messages, status, streamContent, error,
  startAnalysis, sendMessage: sendChatMessage,
  stopGeneration, clearContext, copySummary,
} = useChat()

const selectedModel = ref('deepseek-chat')
const selectedWorkflow = ref('tldr')

const qaInput = ref('')
const outputPanel = ref<HTMLElement | null>(null)

const isStreaming = computed(() => status.value === 'generating')
const isGenerating = computed(() => status.value === 'generating')
const isDone = computed(() => status.value === 'done')
const isIdle = computed(() => status.value === 'idle')

const aiStatusLabel = computed(() => {
  switch (status.value) {
    case 'idle': return '空闲'
    case 'generating': return '正在流式生成...'
    case 'done': return '生成完成 (SUCCESS)'
    case 'error': return '错误'
    default: return '空闲'
  }
})

async function handleRun() {
  const articleId = `art-${Date.now()}`
  const articleTitle = captureStore.extractResult?.title ?? '当前网页剪藏内容'
  const articleMarkdown = captureStore.markdown || '请先在「当前网页」标签中提取网页内容'
  await startAnalysis(articleId, articleTitle, articleMarkdown, selectedWorkflow.value as any)
  scrollToBottom()
}

function handleStop() {
  stopGeneration()
}

async function handleSendQA() {
  const val = qaInput.value.trim()
  if (!val) return
  const articleId = `art-${Date.now()}`
  await sendChatMessage(articleId, val)
  qaInput.value = ''
  scrollToBottom()
}

function handleClear() {
  clearContext()
}

function handleCopy() {
  copySummary()
  toast.showInfo('已复制', 'AI 总结已复制到剪贴板')
}

async function scrollToBottom() {
  await nextTick()
  if (outputPanel.value) {
    outputPanel.value.scrollTop = outputPanel.value.scrollHeight
  }
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- 2.1 Model + Workflow dual dropdowns -->
    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="text-10px font-bold text-gray-400 block mb-1 uppercase">智能体模型 (Model)</label>
        <div class="relative">
          <select
            v-model="selectedModel"
            class="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg pl-2.5 pr-8 py-2 outline-none appearance-none cursor-pointer focus:border-blue-500"
          >
            <option value="deepseek-chat">DeepSeek Chat (默认)</option>
            <option value="claude-3-5">Claude 3.5 Sonnet</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="ollama-llama3">Ollama Local (Llama3)</option>
          </select>
          <ChevronDown class="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>
      <div>
        <label class="text-10px font-bold text-gray-400 block mb-1 uppercase">消化工作流 (Workflow)</label>
        <div class="relative">
          <select
            v-model="selectedWorkflow"
            class="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg pl-2.5 pr-8 py-2 outline-none appearance-none cursor-pointer focus:border-blue-500"
          >
            <option value="tldr">沉浸阅读: TL;DR 摘要</option>
            <option value="knowledge-extractor">核心知识榨汁机</option>
            <option value="action-items">提炼 Action Items</option>
            <option value="generate-tags">生成分类 Tags</option>
          </select>
          <ChevronDown class="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>
    </div>

    <!-- 2.2 AI output panel -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-400 tracking-wider uppercase">AI 深度分析与消化结果</span>
        <span class="text-10px text-gray-400 flex items-center">
          <span
            class="w-1.5 h-1.5 rounded-full mr-1.5"
            :class="{
              'bg-gray-300': isIdle,
              'bg-blue-500 animate-pulse': isGenerating,
              'bg-green-500': isDone,
              'bg-red-500': status === 'error',
            }"
          />
          {{ aiStatusLabel }}
        </span>
      </div>

      <div
        ref="outputPanel"
        class="bg-gray-50 border border-gray-200 rounded-xl p-4 min-h-64 max-h-96 overflow-y-auto text-xs leading-relaxed space-y-3 relative"
      >
        <!-- Placeholder -->
        <div
          v-if="isIdle"
          class="absolute inset-0 flex flex-col items-center justify-center text-gray-400 space-y-2 p-6 text-center"
        >
          <Sparkles class="w-8 h-8 text-blue-400 animate-pulse" />
          <p class="font-semibold text-gray-600 text-xs">选择工作流，一键智能化解析</p>
          <p class="text-10px text-gray-400 max-w-200px">支持多模型调度，流式高表现力打字机输出。</p>
        </div>

        <!-- Error state -->
        <div v-if="status === 'error' && error" class="text-red-600 text-xs p-3 bg-red-50 rounded-lg">
          {{ error }}
        </div>

        <!-- Chat bubbles -->
        <div v-if="messages.length > 0 || streamContent" class="space-y-3">
          <div
            v-for="(msg, i) in messages.filter(m => m.role !== 'system')"
            :key="i"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-85% p-2.5 rounded-lg text-xs shadow-sm"
              :class="msg.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-blue-50 text-blue-900 border border-blue-100'"
            >
              {{ msg.content }}
            </div>
          </div>

          <!-- Streaming indicator -->
          <div v-if="isStreaming && streamContent" class="flex justify-start">
            <div class="bg-blue-50 text-blue-900 border border-blue-100 p-2.5 rounded-lg max-w-85% text-xs whitespace-pre-wrap cursor-blink">
              {{ streamContent }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2.3 Continuous Q&A -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-400 tracking-wider uppercase">基于当前正文连续追问</span>
        <button
          class="text-10px text-red-500 hover:text-red-600 flex items-center space-x-1 bg-transparent border-0 cursor-pointer"
          @click="handleClear"
        >
          <Trash2 class="w-3 h-3" />
          <span>清除上下文 (Reset)</span>
        </button>
      </div>
      <div class="flex items-center space-x-2 bg-gray-100 rounded-xl p-1 border border-gray-200">
        <input
          v-model="qaInput"
          type="text"
          class="flex-grow bg-transparent text-xs outline-none px-2 py-1.5 placeholder-gray-400"
          placeholder="例如：这篇文章对程序员有什么具体的启发？"
          @keydown.enter="handleSendQA"
        >
        <button
          class="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-lg transition border-0 cursor-pointer"
          aria-label="发送追问"
          @click="handleSendQA"
        >
          <Send class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- 2.4 Action buttons -->
    <div class="flex space-x-2 pt-1">
      <button
        v-if="!isStreaming"
        class="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold py-2 px-4 rounded-xl text-xs shadow-sm flex items-center justify-center space-x-2 transition border-0 cursor-pointer"
        @click="handleRun"
      >
        <Play class="w-3.5 h-3.5" />
        <span>一键运行 AI 分析</span>
      </button>
      <button
        v-if="isStreaming"
        class="flex-1 bg-red-100 text-red-700 hover:bg-red-200 font-semibold py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition border-0 cursor-pointer"
        @click="handleStop"
      >
        <Square class="w-3.5 h-3.5" />
        <span>停止生成</span>
      </button>
      <button
        class="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-xl text-xs transition border-0 cursor-pointer"
        title="复制总结"
        @click="handleCopy"
      >
        <Copy class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
