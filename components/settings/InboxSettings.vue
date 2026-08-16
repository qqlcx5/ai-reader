<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Inbox, Plug } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UInput from '@/components/ui/UInput.vue'
import Switch from '@/components/ui/Switch.vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useAppStore } from '@/stores/app.store'

const settingsStore = useSettingsStore()
const appStore = useAppStore()

const enabled = computed({
  get: () => settingsStore.settings.inbox.enabled,
  set: (val: boolean) => settingsStore.updateInboxSettings({ enabled: val }),
})

const endpoint = computed({
  get: () => settingsStore.settings.inbox.endpoint,
  set: (val: string) => settingsStore.updateInboxSettings({ endpoint: val }),
})

const token = computed({
  get: () => settingsStore.settings.inbox.token,
  set: (val: string) => settingsStore.updateInboxSettings({ token: val }),
})

const testing = ref(false)

async function testAndPoll() {
  testing.value = true
  try {
    const res: any = await browser.runtime.sendMessage({ type: 'TRIGGER_INBOX_POLL' })
    if (res?.ok) {
      appStore.showToast(
        res.collected > 0 ? `拉取成功，新增 ${res.collected} 封邮件` : '连接成功，暂无新邮件',
        'success',
      )
    } else {
      appStore.showToast(res?.error || '收件箱连接失败', 'error')
    }
  } catch (e: any) {
    appStore.showToast(e?.message || '收件箱连接失败', 'error')
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
    <div class="p-3 border-b border-zinc-100 flex items-center justify-between">
      <div class="flex flex-col gap-0.5">
        <span class="text-zinc-700 flex items-center gap-1.5"><Inbox class="w-3.5 h-3.5 text-zinc-400" />启用 Newsletter 收件箱</span>
        <span class="text-[11px] text-zinc-400">随 RSS 刷新周期自动拉取，邮件自动入库并加入 AI 分析队列</span>
      </div>
      <Switch v-model="enabled" />
    </div>
    <div class="p-3 flex flex-col gap-2.5">
      <div class="flex flex-col gap-1">
        <span class="text-[11px] text-zinc-500">收件箱 API 地址</span>
        <UInput v-model="endpoint" placeholder="https://news.example.workers.dev/inbox" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 font-mono text-[12px] focus:border-brand" />
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-[11px] text-zinc-500">访问令牌（Bearer Token）</span>
        <UInput v-model="token" type="password" placeholder="token" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 font-mono text-[12px] focus:border-brand" />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-[11px] text-zinc-400">
          部署方法见项目内 <code>doc/newsletter-worker/README.md</code>（Cloudflare Email Worker，约 5 分钟）
        </span>
        <UButton size="sm" variant="secondary" :disabled="testing || !endpoint" @click="testAndPoll">
          <Plug class="w-3.5 h-3.5" />
          {{ testing ? '拉取中…' : '测试并拉取' }}
        </UButton>
      </div>
    </div>
  </div>
</template>
