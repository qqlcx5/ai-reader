<script lang="ts" setup>
import { Sparkles, PlugZap } from '@lucide/vue'
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto p-4 pb-28 flex flex-col gap-5 bg-[#FAFAFA]">
    <!-- Context badge -->
    <div class="flex justify-center">
      <span class="text-[10px] border border-brand/20 bg-indigo-50 text-brand px-2 py-0.5 rounded-md flex items-center gap-1">
        <PlugZap class="w-3 h-3" />
        已挂载当前网页上下文
      </span>
    </div>

    <!-- User message 1 -->
    <div class="flex justify-end">
      <div class="max-w-[84%] bg-brand text-white text-[13px] leading-relaxed px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
        帮我总结这篇文章里关于 CRDT 和 Local-First 的核心观点。
      </div>
    </div>

    <!-- AI response 1 -->
    <div class="flex flex-col gap-2 max-w-[95%]">
      <div class="flex items-center gap-1.5 text-[12px] font-medium text-zinc-900">
        <Sparkles class="w-3.5 h-3.5 text-brand" />
        AuraMind
        <span class="text-[10px] text-zinc-400 font-normal">Claude 3.5 Sonnet</span>
      </div>
      <div class="bg-white border border-zinc-200 rounded-2xl rounded-tl-sm px-3.5 py-3 text-[13px] leading-relaxed text-zinc-800 shadow-sm">
        <p class="mb-2">这篇文章的核心观点是：Local-First 并不是"离线缓存"，而是把本地设备视为数据的第一写入源。</p>
        <p class="mb-2">CRDT 的作用类似"自动合并的 Git"。不同设备即使离线修改同一份数据，恢复网络后也能合并，而不需要用户手动解决冲突。</p>
        <div class="mt-3 p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-brand text-[12px]">
          关键句：云端不再是唯一真相，本地副本也拥有完整主权。
        </div>
      </div>
    </div>

    <!-- User message 2 -->
    <div class="flex justify-end">
      <div class="max-w-[84%] bg-brand text-white text-[13px] leading-relaxed px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
        用一个生活化比喻解释 CRDT。
      </div>
    </div>

    <!-- AI response 2 -->
    <div class="flex flex-col gap-2 max-w-[95%]">
      <div class="flex items-center gap-1.5 text-[12px] font-medium text-zinc-900">
        <Sparkles class="w-3.5 h-3.5 text-brand" />
        AuraMind
      </div>
      <div class="bg-white border border-zinc-200 rounded-2xl rounded-tl-sm px-3.5 py-3 text-[13px] leading-relaxed text-zinc-800 shadow-sm">
        可以把 CRDT 想象成两个人分别在同一张购物清单上加东西：<br><br>
        你离线加了"牛奶"，我离线加了"鸡蛋"。同步时，系统不是问"保留谁的版本"，而是自动得到"牛奶 + 鸡蛋"。
      </div>
    </div>
  </div>
</template>
