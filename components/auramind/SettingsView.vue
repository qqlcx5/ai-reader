<script lang="ts" setup>
import { ref } from 'vue'
import { SlidersHorizontal, Plus, Zap, RefreshCw, Check, Loader2, Trash2, Cpu, Bot, Box } from '@lucide/vue'
import Switch from '@/components/ui/Switch.vue'
import Slider from '@/components/ui/Slider.vue'
import Select from '@/components/ui/Select.vue'
import RekaButton from '@/components/ui/RekaButton.vue'
import RekaInput from '@/components/ui/RekaInput.vue'
import RekaTextarea from '@/components/ui/RekaTextarea.vue'
import ModelCard from './ModelCard.vue'
import ModelModal from './ModelModal.vue'

const gpt4oEnabled = ref(true)
const ollamaEnabled = ref(true)
const webdavSync = ref(true)
const tokenLimit = ref(32)
const systemInstruction = ref('You are AuraMind, a local-first knowledge assistant. Always answer based on injected context. Keep answers structured and concise.')
const webdavUrl = ref('https://dav.jianguoyun.com/dav')
const webdavAccount = ref('')
const webdavPassword = ref('')
const conflictRule = ref('CRDT 自动合并')

const conflictRules = [
  { value: 'CRDT 自动合并', label: 'CRDT 自动合并' },
  { value: '保留本地覆盖', label: '保留本地覆盖' },
  { value: '接受云端版本', label: '接受云端版本' },
  { value: '手动确认', label: '手动确认' },
]

const showModelModal = ref(false)
const testState = ref<'idle' | 'testing' | 'done'>('idle')
const syncState = ref<'idle' | 'syncing' | 'done'>('done')

function testConnection() {
  testState.value = 'testing'
  setTimeout(() => {
    testState.value = 'done'
    setTimeout(() => { testState.value = 'idle' }, 2500)
  }, 1200)
}

function startSync() {
  syncState.value = 'syncing'
  setTimeout(() => {
    syncState.value = 'done'
    setTimeout(() => { syncState.value = 'idle' }, 2200)
  }, 1800)
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
      <RekaButton variant="link" size="sm">保存</RekaButton>
    </div>

    <main class="flex-1 min-h-0 overflow-y-auto px-4 py-5 flex flex-col gap-7">
      <!-- AI 模型池 -->
      <section class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between pl-1">
          <h2 class="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider">AI 模型池</h2>
          <span class="text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded">3 启用</span>
        </div>

        <div class="flex flex-col gap-2">
          <ModelCard name="Claude 3.5 Sonnet" endpoint="api.anthropic.com" :is-default="true" icon-bg="bg-orange-50 border-orange-100 text-orange-500">
            <template #icon><Cpu class="w-4 h-4" /></template>
          </ModelCard>

          <ModelCard name="GPT-4o Mini" endpoint="api.openai.com" model icon-bg="bg-emerald-50 border-emerald-100 text-emerald-600">
            <template #icon><Bot class="w-4 h-4" /></template>
            <template #toggle>
              <Switch v-model="gpt4oEnabled" />
            </template>
          </ModelCard>

          <ModelCard name="Ollama / Llama 3" endpoint="localhost:11434" model icon-bg="bg-zinc-100 border-zinc-200 text-zinc-600">
            <template #icon><Box class="w-4 h-4" /></template>
            <template #toggle>
              <Switch v-model="ollamaEnabled" />
            </template>
          </ModelCard>

          <RekaButton variant="dashed" size="lg" class="w-full" @click="showModelModal = true">
            <Plus class="w-3.5 h-3.5" />
            添加模型节点
          </RekaButton>
        </div>
      </section>

      <!-- 上下文与系统指令 -->
      <section class="flex flex-col gap-2.5">
        <h2 class="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">上下文与系统指令</h2>

        <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
          <div class="p-3 border-b border-zinc-100 flex flex-col gap-2">
            <div class="flex justify-between items-center">
              <span class="text-zinc-700">注入窗口大小限制</span>
              <span class="text-brand font-mono font-medium text-[12px]">{{ tokenLimit }}K Tokens</span>
            </div>
            <Slider v-model="tokenLimit" :min="4" :max="128" :step="4" />
            <div class="flex justify-between text-[10px] text-zinc-400">
              <span>4K 快速</span>
              <span>128K 深度</span>
            </div>
          </div>

          <div class="p-3 flex flex-col gap-1.5">
            <span class="text-zinc-700">全局系统指令</span>
            <RekaTextarea
              v-model="systemInstruction"
              :rows="4"
              class="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-[11px] text-zinc-600 focus:border-brand font-mono"
            />
          </div>
        </div>
      </section>

      <!-- WebDAV 同步 -->
      <section class="flex flex-col gap-2.5">
        <h2 class="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">WebDAV 同步</h2>

        <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
          <div class="p-3 border-b border-zinc-100 flex justify-between items-center">
            <span class="text-zinc-700 whitespace-nowrap mr-3">服务器 URL</span>
            <RekaInput v-model="webdavUrl" class="flex-1 text-right text-zinc-900 placeholder:text-zinc-300" placeholder="https://dav.example.com" />
          </div>
          <div class="p-3 border-b border-zinc-100 flex justify-between items-center">
            <span class="text-zinc-700 whitespace-nowrap mr-3">账号</span>
            <RekaInput v-model="webdavAccount" class="flex-1 text-right text-zinc-900 placeholder:text-zinc-300" placeholder="user@example.com" />
          </div>
          <div class="p-3 border-b border-zinc-100 flex justify-between items-center">
            <span class="text-zinc-700 whitespace-nowrap mr-3">应用密码</span>
            <RekaInput v-model="webdavPassword" type="password" class="h-[30px] flex-1 text-right text-zinc-900 placeholder:text-zinc-300" placeholder="••••••••••" />
          </div>
          <div class="p-3 border-b border-zinc-100 flex items-center justify-between">
            <span class="text-zinc-700">后台增量同步</span>
            <Switch v-model="webdavSync" />
          </div>
          <div class="p-3 flex items-center justify-between">
            <div class="text-zinc-700 w-[120px]">冲突解决规则</div>
            <Select v-model="conflictRule" :options="conflictRules" />
          </div>
        </div>

        <div class="flex gap-2">
          <RekaButton variant="secondary" size="lg" class="flex-1" @click="testConnection">
            <Loader2 v-if="testState === 'testing'" class="w-3.5 h-3.5 animate-spin" />
            <Check v-else-if="testState === 'done'" class="w-3.5 h-3.5 text-emerald-500" />
            <Zap v-else class="w-3.5 h-3.5" />
            <span :class="{ 'text-emerald-600': testState === 'done' }">
              {{ testState === 'testing' ? '连接中...' : testState === 'done' ? '测试通过 120ms' : '测试连接' }}
            </span>
          </RekaButton>

          <RekaButton
            variant="primary"
            size="lg"
            class="flex-1"
            :disabled="syncState === 'syncing'"
            @click="startSync"
          >
            <RefreshCw v-if="syncState === 'idle'" class="w-3.5 h-3.5" />
            <RefreshCw v-else-if="syncState === 'syncing'" class="w-3.5 h-3.5 animate-spin" />
            <Check v-else class="w-3.5 h-3.5" />
            <span>{{ syncState === 'syncing' ? '同步中...' : syncState === 'done' ? '同步完成' : '立即同步' }}</span>
          </RekaButton>
        </div>

        <div class="text-center text-[11px] text-zinc-400 flex justify-center items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          上次同步：今天 09:41
        </div>
      </section>

      <!-- 本地存储 -->
      <section class="flex flex-col gap-2.5 pb-8">
        <h2 class="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider pl-1">本地存储</h2>

        <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
          <div class="p-3 border-b border-zinc-100 flex justify-between">
            <span class="text-zinc-700">IndexedDB 占用</span>
            <span class="font-mono text-[12px] text-zinc-500">24.5 MB</span>
          </div>
          <div class="p-3 border-b border-zinc-100 flex justify-between">
            <span class="text-zinc-700">文档数量</span>
            <span class="font-mono text-[12px] text-zinc-500">5,241</span>
          </div>
          <div class="p-3 flex justify-between">
            <span class="text-zinc-700">向量索引</span>
            <span class="font-mono text-[12px] text-zinc-500">Ready</span>
          </div>
        </div>

        <RekaButton variant="danger" size="lg" class="w-full">
          <Trash2 class="w-4 h-4" />
          清空本地数据
        </RekaButton>
      </section>
    </main>

    <ModelModal :visible="showModelModal" @close="showModelModal = false" />
  </div>
</template>
