<script setup lang="ts">
interface Props {
  query: string
  category: string
  enabled: string
  favorite: boolean
  categories: string[]
}

defineProps<Props>()
const emit = defineEmits<{
  'update:query': [value: string]
  'update:category': [value: string]
  'update:enabled': [value: string]
  'update:favorite': [value: boolean]
  reset: []
}>()
</script>

<template>
  <section class="filters" aria-label="Skill 筛选">
    <label class="search-field">
      <span>搜索</span>
      <input
        :value="query"
        type="search"
        placeholder="名称、场景、触发词"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      <span>类别</span>
      <select :value="category" @change="emit('update:category', ($event.target as HTMLSelectElement).value)">
        <option value="">全部类别</option>
        <option v-for="item in categories" :key="item" :value="item">{{ item }}</option>
      </select>
    </label>
    <label>
      <span>状态</span>
      <select :value="enabled" @change="emit('update:enabled', ($event.target as HTMLSelectElement).value)">
        <option value="">全部状态</option>
        <option value="true">已启用</option>
        <option value="false">已停用</option>
      </select>
    </label>
    <label class="check-field">
      <input :checked="favorite" type="checkbox" @change="emit('update:favorite', ($event.target as HTMLInputElement).checked)" />
      <span>只看收藏</span>
    </label>
    <button class="quiet-button" type="button" @click="emit('reset')">重置</button>
  </section>
</template>
