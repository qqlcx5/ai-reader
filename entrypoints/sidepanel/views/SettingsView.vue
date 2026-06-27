<script setup lang="ts">
import { ref } from 'vue'
import { Key, ShieldCheck, Cloud, FileJson, Upload, Package, Eye, EyeOff, ArrowLeft } from '@lucide/vue'
import { useSettings } from '../composables/useSettings'
import { usePopupStore } from '@/stores/popup'
import { useToast } from '../composables/useToast'
import { articleRepo } from '@/db/article.repository'
import { exportArticleObsidian, downloadFile } from '@/core/export/obsidian-exporter'
import JSZip from 'jszip'

const popup = usePopupStore()
const toast = useToast()
const { settings } = useSettings()

const apiEndpoint = ref('https://api.deepseek.com/v1')
const apiKey = ref('')
const showKey = ref(false)

const webdavEnabled = ref(true)
const webdavAccount = ref('superbrain_user@jianguoyun.com')
const webdavPassword = ref('')

function handleBack() {
  popup.goBack()
}

async function exportJSON() {
  try {
    const articles = await articleRepo.getAll()
    if (articles.length === 0) {
      toast.showInfo('无数据', '本地知识库为空，无需导出')
      return
    }
    const json = JSON.stringify(articles, null, 2)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `superbrain-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.showSuccess('导出成功', `已导出 ${articles.length} 篇文章`)
  } catch (err: any) {
    toast.showError('导出失败', err.message ?? '未知错误')
  }
}

function importRestore() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const articles = JSON.parse(text)
      if (!Array.isArray(articles)) {
        toast.showError('格式错误', 'JSON 文件格式不正确')
        return
      }
      let count = 0
      for (const article of articles) {
        if (article.id && article.title && article.url) {
          await articleRepo.save(article)
          count++
        }
      }
      toast.showSuccess('恢复成功', `已恢复 ${count} 条`)
    } catch (err: any) {
      toast.showError('导入失败', err.message ?? '未知错误')
    }
  }
  input.click()
}

async function exportObsidianZip() {
  try {
    const articles = await articleRepo.getAll()
    if (articles.length === 0) {
      toast.showInfo('无数据', '本地知识库为空，无法打包')
      return
    }
    const zip = new JSZip()
    for (const article of articles) {
      const result = exportArticleObsidian(article)
      zip.file(result.filename, result.content)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SuperBrain-Obsidian-Vault-${new Date().toISOString().slice(0, 10)}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.showSuccess('打包完成', `已打包 ${articles.length} 篇为 Obsidian ZIP 归档`)
  } catch (err: any) {
    toast.showError('打包失败', err.message ?? '未知错误')
  }
}
</script>

<template>
  <div class="p-4 space-y-5">
    <!-- Back button -->
    <button
      class="flex items-center space-x-1 text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer text-xs"
      @click="handleBack"
    >
      <ArrowLeft class="w-4 h-4" />
      <span>返回</span>
    </button>

    <!-- 4.1 LLM BYOK Config -->
    <div class="space-y-3">
      <div class="flex items-center justify-between border-b border-gray-100 pb-1.5">
        <span class="text-xs font-bold text-gray-900 flex items-center">
          <Key class="w-4 h-4 mr-1.5 text-blue-500" />
          LLM 模型服务商配置 (BYOK)
        </span>
        <span class="text-9px text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex items-center">
          <ShieldCheck class="w-2.5 h-2.5 mr-0.5" /> AES-GCM 本地加密
        </span>
      </div>
      <div class="space-y-2">
        <div>
          <label class="text-10px font-bold text-gray-400 block mb-1">API ENDPOINT (Base URL)</label>
          <input
            v-model="apiEndpoint"
            type="text"
            class="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500"
          >
        </div>
        <div>
          <label class="text-10px font-bold text-gray-400 block mb-1">API KEY (加密存储)</label>
          <div class="relative flex items-center">
            <input
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              placeholder="••••••••••••••••••••"
              class="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg pl-2.5 pr-10 py-1.5 outline-none focus:border-blue-500"
            >
            <button
              class="absolute right-3 text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer p-0"
              @click="showKey = !showKey"
            >
              <EyeOff v-if="!showKey" class="w-3.5 h-3.5" />
              <Eye v-else class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 4.2 WebDAV Sync -->
    <div class="space-y-3">
      <div class="flex items-center justify-between border-b border-gray-100 pb-1.5">
        <span class="text-xs font-bold text-gray-900 flex items-center">
          <Cloud class="w-4 h-4 mr-1.5 text-blue-500" />
          WebDAV 每日静默同步 (坚果云/Nextcloud)
        </span>
        <label class="relative inline-flex items-center cursor-pointer scale-75">
          <input v-model="webdavEnabled" type="checkbox" class="sr-only peer">
          <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-2px after:left-2px after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
        </label>
      </div>
      <div class="space-y-2">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-10px font-bold text-gray-400 block mb-1">WEBDAV 账号</label>
            <input
              v-model="webdavAccount"
              type="text"
              class="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500"
            >
          </div>
          <div>
            <label class="text-10px font-bold text-gray-400 block mb-1">同步校验密码</label>
            <input
              v-model="webdavPassword"
              type="password"
              placeholder="••••••••"
              class="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500"
            >
          </div>
        </div>
      </div>
    </div>

    <!-- 4.3 Backup & Restore -->
    <div class="space-y-3">
      <span class="text-xs font-bold text-gray-900 block border-b border-gray-100 pb-1.5">本地存储持久化与流转</span>
      <div class="grid grid-cols-2 gap-2">
        <button
          class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1.5 border-0 cursor-pointer"
          @click="exportJSON"
        >
          <FileJson class="w-3.5 h-3.5" />
          <span>导出 JSON 备份</span>
        </button>
        <button
          class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2 px-3 rounded-lg transition flex items-center justify-center space-x-1.5 border-0 cursor-pointer"
          @click="importRestore"
        >
          <Upload class="w-3.5 h-3.5" />
          <span>导入恢复数据</span>
        </button>
      </div>
      <button
        class="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center space-x-2 border border-blue-200 shadow-sm shadow-blue-50 cursor-pointer"
        @click="exportObsidianZip"
      >
        <Package class="w-4 h-4" />
        <span>一键打包导出 Obsidian 兼容 .ZIP 归档</span>
      </button>
    </div>
  </div>
</template>
