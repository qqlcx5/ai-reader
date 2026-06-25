<script lang="ts" setup>
// 工具栏 popup 已停用：点击图标改为打开 Side Panel（见 background.ts onClicked）
// 此处保留为最小占位以避免 WXT 报错
</script>

<template>
  <div class="popup-placeholder">
    <p>ReadChat</p>
  </div>
</template>

<style scoped>
.popup-placeholder {
  width: 100px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #666;
}
</style>
