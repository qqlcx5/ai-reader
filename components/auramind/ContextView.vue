<script lang="ts" setup>
import { ref } from 'vue'
import { FileText, Code2, Info, Copy } from '@lucide/vue'

const activeTab = ref<'md' | 'raw' | 'meta'>('md')

const tabs = [
  { key: 'md' as const, label: 'Markdown 预览', icon: FileText },
  { key: 'raw' as const, label: '原始内容', icon: Code2 },
  { key: 'meta' as const, label: '元数据', icon: Info },
]
</script>

<template>
  <div class="flex-1 min-h-0 overflow-hidden flex flex-col bg-white">
    <!-- Sub Tabs -->
    <div class="h-9 shrink-0 flex items-center gap-4 px-4 border-b border-zinc-100 bg-zinc-50/80 text-[11px] font-medium">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="h-full flex items-center gap-1 transition-colors"
        :class="activeTab === tab.key
          ? 'text-brand border-b-2 border-brand'
          : 'text-zinc-400 hover:text-zinc-700'"
        @click="activeTab = tab.key"
      >
        <component :is="tab.icon" class="w-3 h-3" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Markdown Preview -->
    <div v-show="activeTab === 'md'" class="flex-1 overflow-y-auto p-5 prose-lite">
      <h1>Local-First 软件设计原则</h1>
      <p>云计算带来了极大的便利，但也让用户逐渐失去了对数据的控制权。Local-First 软件试图重新平衡这种关系：既保留云同步的便利，又让本地设备成为数据的主要载体。</p>
      <h2>核心思想</h2>
      <blockquote><p>在 Local-First 架构中，本地设备是主要的数据读写节点，云端只是同步和备份媒介。</p></blockquote>
      <p>这意味着用户即使在断网状态下，依然可以完整地创建、编辑、搜索和组织自己的知识库。</p>
      <h2>CRDT 的作用</h2>
      <p>CRDT，即 <code>Conflict-free Replicated Data Type</code>，可以理解为一种"天然可合并"的数据结构。它允许多个副本独立变化，并在之后自动合并。</p>
      <ul>
        <li>无需中心服务器裁决最终版本。</li>
        <li>无需用户手动处理大多数冲突。</li>
        <li>非常适合笔记、知识库、任务列表、协作文档。</li>
      </ul>
      <h2>典型技术栈</h2>
      <p>常见实现包括 <code>Yjs</code>、<code>Automerge</code>、<code>Replicache</code>、<code>ElectricSQL</code> 等。对 AuraMind 而言，Local-First 的意义是：网页抓取、AI 对话、摘要和用户标注都可以优先保存在本地。</p>
      <h3>对于 AI 知识库的意义</h3>
      <p>AI 产品如果只依赖云端，就会形成新的数据黑箱。Local-First 能让用户明确知道：我的原文、摘要、向量索引、对话记录都掌握在自己手里。</p>
    </div>

    <!-- Raw Content -->
    <div v-show="activeTab === 'raw'" class="flex-1 overflow-y-auto bg-zinc-900 p-4">
      <pre class="text-[11px] leading-relaxed text-zinc-300 font-mono whitespace-pre-wrap"><code># Local-First 软件设计原则

云计算带来了极大的便利，但也让用户逐渐失去了对数据的控制权。Local-First 软件试图重新平衡这种关系：
既保留云同步的便利，又让本地设备成为数据的主要载体。

## 核心思想

> 在 Local-First 架构中，本地设备是主要的数据读写节点，云端只是同步和备份媒介。

这意味着用户即使在断网状态下，依然可以完整地创建、编辑、搜索和组织自己的知识库。

## CRDT 的作用

CRDT，即 `Conflict-free Replicated Data Type`，可以理解为一种"天然可合并"的数据结构。
它允许多个副本独立变化，并在之后自动合并。

- 无需中心服务器裁决最终版本。
- 无需用户手动处理大多数冲突。
- 非常适合笔记、知识库、任务列表、协作文档。

## 典型技术栈

常见实现包括 `Yjs`、`Automerge`、`Replicache`、`ElectricSQL` 等。
对 AuraMind 而言，Local-First 的意义是：网页抓取、AI 对话、摘要和用户标注都可以优先保存在本地。</code></pre>
    </div>

    <!-- Metadata -->
    <div v-show="activeTab === 'meta'" class="flex-1 overflow-y-auto p-4 bg-zinc-50">
      <div class="bg-white border border-zinc-200 rounded-xl overflow-hidden text-[13px] shadow-sm">
        <div class="p-3 border-b border-zinc-100 flex justify-between">
          <span class="text-zinc-500">标题</span>
          <span class="font-medium text-zinc-900 text-right max-w-[210px]">Local-First 软件设计原则</span>
        </div>
        <div class="p-3 border-b border-zinc-100 flex justify-between">
          <span class="text-zinc-500">来源</span>
          <span class="font-mono text-[11px] text-zinc-700">inkandswitch.com</span>
        </div>
        <div class="p-3 border-b border-zinc-100 flex justify-between">
          <span class="text-zinc-500">抓取方式</span>
          <span class="text-zinc-700">Readability + DOM 清洗</span>
        </div>
        <div class="p-3 border-b border-zinc-100 flex justify-between">
          <span class="text-zinc-500">Markdown 字数</span>
          <span class="font-mono text-[11px] text-zinc-700">6,842 chars</span>
        </div>
        <div class="p-3 border-b border-zinc-100 flex justify-between">
          <span class="text-zinc-500">Token 估算</span>
          <span class="font-mono text-[11px] text-brand">3,421 tokens</span>
        </div>
        <div class="p-3 flex justify-between">
          <span class="text-zinc-500">本地状态</span>
          <span class="text-emerald-600 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            已保存 IndexedDB
          </span>
        </div>
      </div>
      <button class="mt-3 w-full py-2.5 rounded-xl bg-white border border-zinc-200 text-[13px] text-zinc-700 font-medium hover:bg-zinc-50 flex items-center justify-center gap-2">
        <Copy class="w-4 h-4" />
        复制 Markdown
      </button>
    </div>
  </div>
</template>
