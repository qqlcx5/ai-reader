<script lang="ts" setup>
import { ref, onUnmounted, nextTick } from 'vue'
import Select from '@/components/ui/Select.vue'

const emit = defineEmits<{
  showToast: [title: string, desc: string]
}>()

const selectedModel = ref('deepseek-chat')
const selectedWorkflow = ref('tldr')
const running = ref(false)
const stopped = ref(false)
const statusText = ref('空闲')
const statusColor = ref('bg-gray-300')
const outputText = ref('')
const qaInput = ref('')
const qaMessages = ref<Array<{ role: 'user' | 'ai'; text: string }>>([])

let streamTimer: ReturnType<typeof setInterval> | null = null

const models = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat (默认)' },
  { value: 'claude-3-5', label: 'Claude 3.5 Sonnet' },
  { value: 'gpt-4o', label: 'GPT-4o (中转/本地代理)' },
  { value: 'ollama-llama3', label: 'Ollama Local (离线 Llama3)' },
]

const workflows = [
  { value: 'tldr', label: '沉浸阅读: TL;DR 摘要' },
  { value: 'juice', label: '核心知识榨汁机' },
  { value: 'action', label: '提炼 Action Items' },
  { value: 'tags', label: '生成分类 Tags' },
]

const mockOutputs: Record<string, string> = {
  tldr: `### 【太长不看 (TL;DR)】
本文是由知识管理专家 Tiago Forte 撰写的核心指南。文章阐明了通过建立数字辅助"第二大脑"来降低认知压力，释放人脑底层创造力的方法。

---

### 核心观点榨汁
1. **记忆是创造力的敌人**：大脑应当被视作处理器而不是存储硬盘。
2. **CODE 运行模型**：
   - **C**apture (捕获): 精简无噪资产
   - **O**rganize (组织): PARA 结构化
   - **D**istill (提炼): 榨取高含金量知识点
   - **E**xpress (表达): 输出赋能实践

---

### 行动指南建议
- [ ] 建议立即在 Notion 或 Obsidian 中建立 PARA 笔记本。
- [ ] 开启 WebDAV 静默增量同步，将今天的知识捕获进 Obsidian 文件夹。`,
  juice: `### 核心知识榨汁

#### 1. 核心概念
- **第二大脑** = 外部数字化知识仓库
- 降低认知负担 → 释放深层创造力

#### 2. 方法论 (CODE)
- **Capture**：精准捕获高价值信息
- **Organize**：PARA 四象限分类法
- **Distill**：逐层提炼核心知识点
- **Express**：输出赋能实际工作

#### 3. 实践建议
- 立即在 Notion/Obsidian 建立 PARA 笔记本
- 每周固定时间回顾和整理收藏
- 使用 PageMind 实现自动化知识入库`,
  action: `### Action Items 行动清单

- [ ] 在 Obsidian 中创建 PARA 文件夹结构
- [ ] 设置 WebDAV 同步到 Obsidian Vault
- [ ] 本周收集 5 篇高质量文章到知识库
- [ ] 为每篇文章生成 AI 摘要并打标签
- [ ] 周末回顾本周收藏，提炼核心洞察
- [ ] 建立个人知识输出习惯（每周 1 篇笔记）`,
  tags: `### 智能标签建议

**推荐标签**
- #PKM — 个人知识管理
- #Productivity — 效率方法论
- #SecondBrain — 第二大脑概念
- #CODE — Capture/Organize/Distill/Express
- #PARA — 组织方法论
- #Obsidian — 工具推荐`,
}

function startStream() {
  if (running.value) return
  running.value = true
  stopped.value = false
  outputText.value = ''
  statusText.value = '正在流式生成...'
  statusColor.value = 'bg-blue-500'

  const fullText = mockOutputs[selectedWorkflow.value] || mockOutputs.tldr
  let index = 0

  const container = document.getElementById('ai-typewriter')
  if (container) container.classList.add('cursor-blink')

  streamTimer = setInterval(() => {
    if (index < fullText.length) {
      outputText.value += fullText[index]
      index++
      nextTick(() => {
        const panel = document.getElementById('ai-output-panel')
        if (panel) panel.scrollTop = panel.scrollHeight
      })
    } else {
      finishStream()
    }
  }, 15)
}

function stopStream() {
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
  running.value = false
  stopped.value = true
  statusText.value = '生成完成 (SUCCESS)'
  statusColor.value = 'bg-green-500'
  const container = document.getElementById('ai-typewriter')
  if (container) container.classList.remove('cursor-blink')
}

function finishStream() {
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
  running.value = false
  stopped.value = true
  statusText.value = '生成完成 (SUCCESS)'
  statusColor.value = 'bg-green-500'
  const container = document.getElementById('ai-typewriter')
  if (container) container.classList.remove('cursor-blink')
}

function clearContext() {
  outputText.value = ''
  qaMessages.value = []
  statusText.value = '空闲'
  statusColor.value = 'bg-gray-300'
  emit('showToast', '上下文已清除', 'Q&A 对话历史已重置')
}

function copyOutput() {
  if (!outputText.value) {
    emit('showToast', '无可复制内容', '请先运行 AI 分析')
    return
  }
  navigator.clipboard.writeText(outputText.value)
  emit('showToast', '已复制到剪切板', '可粘贴到 Notion 或 Obsidian')
}

function triggerQA() {
  const question = qaInput.value.trim()
  if (!question) return

  qaMessages.value.push({ role: 'user', text: question })
  qaInput.value = ''

  setTimeout(() => {
    qaMessages.value.push({
      role: 'ai',
      text: `关于您的提问 "${question}"：构建第二大脑能有效防范信息过载对脑细胞的损耗。在工作中，建议您把知识库作为外部检索代理，只专注于高阶战略性输出。`,
    })
    nextTick(() => {
      const panel = document.getElementById('ai-output-panel')
      if (panel) panel.scrollTop = panel.scrollHeight
    })
  }, 1500)
}

onUnmounted(() => {
  if (streamTimer) clearInterval(streamTimer)
})
</script>

<template>
  <section class="p-4 space-y-4">
    <!-- 多模型快速调度器 -->
    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="text-[10px] font-bold text-gray-400 block mb-1 uppercase">智能体模型 (Model)</label>
        <Select v-model="selectedModel" :options="models" />
      </div>
      <div>
        <label class="text-[10px] font-bold text-gray-400 block mb-1 uppercase">消化工作流 (Workflow)</label>
        <Select v-model="selectedWorkflow" :options="workflows" />
      </div>
    </div>

    <!-- 流式生成响应视窗 -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-400 tracking-wider uppercase">AI 深度分析与消化结果</span>
        <span class="text-[10px] text-gray-400 flex items-center">
          <span class="w-1.5 h-1.5 rounded-full mr-1.5" :class="[statusColor, running ? 'animate-pulse' : '']"></span>
          {{ statusText }}
        </span>
      </div>
      <div id="ai-output-panel" class="bg-gray-50 border border-gray-200 rounded-xl p-4 min-h-64 max-h-96 overflow-y-auto text-xs leading-relaxed space-y-3 relative">
        <!-- 缺省状态占位符 -->
        <div v-if="!outputText && !running" class="absolute inset-0 flex flex-col items-center justify-center text-gray-400 space-y-2 p-6 text-center">
          <svg class="w-8 h-8 text-blue-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          <p class="font-semibold text-gray-600 text-xs">选择工作流，一键智能化解析</p>
          <p class="text-[10px] text-gray-400 max-w-[200px]">支持多模型调度，流式高表现力打字机输出。</p>
        </div>

        <!-- 动态生成区域 -->
        <div v-if="outputText" id="ai-typewriter" class="whitespace-pre-wrap font-medium text-gray-800">
          {{ outputText }}<span v-if="running" class="animate-pulse text-blue-500">▌</span>
        </div>

        <!-- Q&A 消息嵌入输出面板 -->
        <template v-if="qaMessages.length">
          <div v-for="(msg, i) in qaMessages" :key="'qa-' + i">
            <div v-if="msg.role === 'user'" class="flex justify-end mb-3">
              <div class="bg-blue-500 text-white p-2.5 rounded-lg max-w-[80%] font-semibold text-xs shadow-sm">{{ msg.text }}</div>
            </div>
            <div v-else class="flex justify-start mb-3">
              <div class="bg-blue-50 text-blue-900 border border-blue-100 p-3 rounded-lg max-w-[85%] text-xs font-medium leading-relaxed">
                {{ msg.text }}
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 连续追问 Q&A Panel -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-400 tracking-wider uppercase">基于当前正文连续追问</span>
        <button
          class="text-[10px] text-red-500 hover:text-red-600 flex items-center space-x-1 bg-transparent border-0 cursor-pointer p-0 transition"
          @click="clearContext"
        >
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          <span>清除上下文 (Reset)</span>
        </button>
      </div>
      <div class="flex items-center space-x-2 bg-gray-100 rounded-xl p-1 border border-gray-200">
        <input
          v-model="qaInput"
          type="text"
          class="flex-grow bg-transparent text-xs text-gray-800 outline-none px-2 py-1.5 placeholder-gray-400"
          placeholder="例如：这篇文章对程序员有什么具体的启发？"
          @keydown.enter="triggerQA"
        >
        <button
          class="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-lg transition cursor-pointer border-0 inline-flex items-center justify-center"
          @click="triggerQA"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>

    <!-- 操作功能键区 -->
    <div class="flex space-x-2 pt-1">
      <button
        v-if="!running"
        class="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold py-2 px-4 rounded-xl text-xs shadow-sm flex items-center justify-center space-x-2 transition cursor-pointer border-0"
        @click="startStream"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>一键运行 AI 分析</span>
      </button>
      <button
        v-else
        class="bg-red-100 text-red-700 hover:bg-red-200 font-semibold py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition flex-1 cursor-pointer border-0"
        @click="stopStream"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
        <span>停止生成</span>
      </button>
      <button
        class="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-xl text-xs transition cursor-pointer border-0 inline-flex items-center justify-center"
        title="复制总结"
        @click="copyOutput"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    </div>
  </section>
</template>
