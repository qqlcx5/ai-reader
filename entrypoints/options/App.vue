<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900">
    <div class="max-w-3xl mx-auto py-8 px-4">
      <div class="flex items-center gap-3 mb-8">
        <div class="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">AI Reader 设置</h1>
      </div>

      <div class="card p-6 mb-6">
        <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">模型管理</h2>
        <ModelSettings />
      </div>

      <div class="card p-6 mb-6">
        <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">WebDAV 同步</h2>
        <WebDAVSettings />
      </div>

      <div class="card p-6">
        <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">系统提示词</h2>
        <PromptSettings />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ModelSettings from './ModelSettings.vue'
import WebDAVSettings from './WebDAVSettings.vue'
import PromptSettings from './PromptSettings.vue'
</script>
