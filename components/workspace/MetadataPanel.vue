<script lang="ts" setup>
import { computed } from 'vue'
import { ExternalLink } from '@lucide/vue'
import { useDocumentStore } from '@/stores/document.store'

const documentStore = useDocumentStore()

const doc = computed(() => documentStore.currentDocument)

interface FieldDef {
  key: string
  label: string
  format?: (val: any) => string
}

const fields: FieldDef[] = [
  { key: 'title', label: '标题' },
  { key: 'url', label: 'URL' },
  { key: 'canonicalUrl', label: 'Canonical URL' },
  { key: 'siteName', label: '站点名称' },
  { key: 'author', label: '作者' },
  { key: 'description', label: '描述' },
  { key: 'publishedAt', label: '发布时间' },
  { key: 'capturedAt', label: '抓取时间' },
  { key: 'updatedAt', label: '更新时间' },
  { key: 'wordCount', label: '字数', format: (v: number) => v?.toLocaleString() },
  { key: 'tokenCount', label: 'Token 数', format: (v: number) => v?.toLocaleString() },
  { key: 'extractionMethod', label: '抓取方式' },
  { key: 'contentHash', label: '内容哈希' },
  { key: 'source', label: '来源' },
]

function getValue(key: string): string | number | undefined {
  if (!doc.value) return undefined
  return (doc.value as any)[key]
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4 bg-zinc-50">
    <div class="grid grid-cols-2 gap-px bg-zinc-200 rounded-xl overflow-hidden border border-zinc-200 text-[13px]">
      <template v-for="field in fields" :key="field.key">
        <div class="bg-white px-3 py-2.5 text-zinc-500 font-medium">
          {{ field.label }}
        </div>
        <div class="bg-white px-3 py-2.5 text-zinc-900 break-all">
          <template v-if="getValue(field.key) !== undefined && getValue(field.key) !== ''">
            <template v-if="field.key === 'url'">
              <a
                :href="getValue('url') as string"
                target="_blank"
                rel="noopener noreferrer"
                class="text-brand hover:underline inline-flex items-center gap-1"
              >
                {{ getValue('url') }}
                <ExternalLink class="w-3 h-3 shrink-0" />
              </a>
            </template>
            <template v-else-if="field.format">
              {{ field.format(getValue(field.key)) }}
            </template>
            <template v-else>
              {{ getValue(field.key) }}
            </template>
          </template>
          <span v-else class="text-zinc-300">—</span>
        </div>
      </template>
    </div>
  </div>
</template>
