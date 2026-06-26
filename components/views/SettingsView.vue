<script lang="ts" setup>
import { ref, computed } from 'vue'
import SectionHead from '../common/SectionHead.vue'

const emit = defineEmits<{
  showToast: [title: string, desc: string]
}>()

const settings = ref({
  autoSave: true,
  toast: true,
  frontmatter: true,
  readerStyle: true,
})

type SettingKey = keyof typeof settings.value

const labels: Record<SettingKey, { title: string; desc: string }> = {
  autoSave: { title: '自动保存到 IndexedDB', desc: '提取成功后直接写入本地数据库。' },
  toast: { title: '保存后显示 Toast', desc: '完成、复制、删除等动作给出轻提示。' },
  frontmatter: { title: '生成 Markdown 元数据', desc: '在 Markdown 顶部写入标题、作者、来源和时间。' },
  readerStyle: { title: '阅读器高级排版', desc: '使用 Apple 风格间距、浅色卡片和细边框。' },
}

const settingKeys = computed(() => Object.keys(settings.value) as SettingKey[])

function toggle(key: SettingKey) {
  settings.value[key] = !settings.value[key]
  emit('showToast', settings.value[key] ? '设置已开启' : '设置已关闭', '偏好已保存到本地配置')
}

function reset() {
  settings.value = { autoSave: true, toast: true, frontmatter: true, readerStyle: true }
  emit('showToast', '已恢复默认设置', '所有插件偏好已重置为推荐状态')
}
</script>

<template>
  <section class="h-full overflow-auto pb-3.5">
    <!-- Settings Card -->
    <div
      class="p-3.5 rounded-20px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(0,0,0,0.04)"
    >
      <SectionHead title="Settings" action="恢复默认" @action="reset" />

      <div
        v-for="key in settingKeys"
        :key="key"
        class="py-3 flex items-center justify-between gap-4"
        style="border-bottom: 1px solid rgba(29,29,31,0.08)"
        :class="{ 'border-b-0!': key === 'readerStyle' }"
      >
        <div>
          <div class="text-13px font-bold">{{ labels[key].title }}</div>
          <div class="mt-1 text-11px text-#6e6e73 leading-snug">{{ labels[key].desc }}</div>
        </div>
        <button
          class="w-44px h-26px p-0.75 rounded-full cursor-pointer transition-all duration-150 flex-shrink-0"
          :class="settings[key] ? 'bg-#111' : 'bg-#d4d4d8'"
          @click="toggle(key)"
        >
          <span
            class="block w-20px h-20px rounded-full bg-white transition-all duration-150"
            :class="settings[key] ? 'translate-x-4.5' : 'translate-x-0'"
            style="box-shadow: 0 2px 6px rgba(0,0,0,0.16)"
          />
        </button>
      </div>
    </div>

    <!-- Storage Info -->
    <div
      class="mt-3 p-3.5 rounded-20px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(0,0,0,0.04)"
    >
      <SectionHead title="Storage" action="Local-first" />
      <div class="p-3 rounded-16px border border-rgba(29,29,31,0.08) bg-rgba(250,250,250,0.74)">
        <div class="mb-2 text-13px font-bold tracking-tight">本地优先架构</div>
        <div class="text-#52525b text-12px leading-relaxed">
          插件只负责采集当前网页，文章、Markdown、元数据和阅读状态都保存在 IndexedDB。
          后续可以扩展 WebDAV、导出 Markdown、全文搜索和 AI 总结。
        </div>
      </div>
    </div>
  </section>
</template>
