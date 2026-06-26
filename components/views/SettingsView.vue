<script lang="ts" setup>
import { ref } from 'vue'
import { SwitchRoot, SwitchThumb, Separator, Label } from 'reka-ui'

const emit = defineEmits<{
  showToast: [title: string, desc: string]
}>()

const byokEndpoint = ref('https://api.deepseek.com/v1')
const byokKey = ref('')
const byokKeyVisible = ref(false)

const webdavEnabled = ref(true)
const webdavAccount = ref('')
const webdavPassword = ref('')

function toggleKeyVisible() {
  byokKeyVisible.value = !byokKeyVisible.value
}

function exportJSON() {
  emit('showToast', '导出 JSON 备份', '正在打包本地数据，即将开始下载...')
}

function importJSON() {
  emit('showToast', '导入恢复数据', '请上传 SuperBrain JSON 或 ZIP 归档文件，系统将自动执行分流合并机制')
}

function exportObsidian() {
  emit('showToast', '导出 Obsidian 归档', '正在组装 JSZip 压缩包，转换为 Obsidian YAML 格式 Markdown...')
}
</script>

<template>
  <section class="p-4 space-y-5">
    <!-- BYOK 模型配置区 -->
    <div class="space-y-3">
      <div class="flex items-center justify-between pb-1.5">
        <span class="text-xs font-bold text-gray-900 flex items-center">
          <svg class="w-4 h-4 mr-1.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          LLM 模型服务商配置 (BYOK)
        </span>
        <span class="text-[9px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex items-center">
          <svg class="w-2.5 h-2.5 mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          AES-GCM 本地加密
        </span>
      </div>
      <Separator class="h-px bg-gray-100" />
      <div class="space-y-2">
        <div>
          <Label class="text-[10px] font-bold text-gray-400 block mb-1">API ENDPOINT (Base URL)</Label>
          <input
            v-model="byokEndpoint"
            type="text"
            class="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
          >
        </div>
        <div>
          <Label class="text-[10px] font-bold text-gray-400 block mb-1">API KEY (加密存储)</Label>
          <div class="relative flex items-center">
            <input
              v-model="byokKey"
              :type="byokKeyVisible ? 'text' : 'password'"
              class="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg pl-2.5 pr-10 py-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              placeholder="••••••••••••••••••••••••••••••••"
            >
            <button
              class="absolute right-3 text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer p-0 transition"
              @click="toggleKeyVisible"
            >
              <svg v-if="!byokKeyVisible" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
              <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- WebDAV 云端同步 -->
    <div class="space-y-3">
      <div class="flex items-center justify-between pb-1.5">
        <span class="text-xs font-bold text-gray-900 flex items-center">
          <svg class="w-4 h-4 mr-1.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
          WebDAV 每日静默同步 (坚果云/Nextcloud)
        </span>
        <SwitchRoot
          v-model:checked="webdavEnabled"
          class="w-9 h-5 bg-gray-200 rounded-full relative cursor-pointer transition-colors data-[state=checked]:bg-blue-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <SwitchThumb
            class="block w-4 h-4 bg-white rounded-full transition-transform duration-150 translate-x-[-4px] data-[state=checked]:translate-x-[12px]"
            style="box-shadow: 0 2px 6px rgba(0,0,0,0.16)"
          />
        </SwitchRoot>
      </div>
      <Separator class="h-px bg-gray-100" />
      <div class="space-y-2">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <Label class="text-[10px] font-bold text-gray-400 block mb-1">WEBDAV 账号</Label>
            <input
              v-model="webdavAccount"
              type="text"
              class="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              placeholder="user@jianguoyun.com"
            >
          </div>
          <div>
            <Label class="text-[10px] font-bold text-gray-400 block mb-1">同步校验密码</Label>
            <input
              v-model="webdavPassword"
              type="password"
              class="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            >
          </div>
        </div>
      </div>
    </div>

    <!-- 本地存储持久化与流转 -->
    <div class="space-y-3">
      <span class="text-xs font-bold text-gray-900 block pb-1.5">本地存储持久化与流转</span>
      <Separator class="h-px bg-gray-100" />
      <div class="grid grid-cols-2 gap-2">
        <button
          class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer border-0"
          @click="exportJSON"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>导出 JSON 备份</span>
        </button>
        <button
          class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer border-0"
          @click="importJSON"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>导入恢复数据</span>
        </button>
      </div>
      <button
        class="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center space-x-2 border border-blue-200 shadow-sm shadow-blue-50 cursor-pointer"
        @click="exportObsidian"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
        <span>一键打包导出 Obsidian 兼容 .ZIP 归档</span>
      </button>
    </div>
  </section>
</template>
