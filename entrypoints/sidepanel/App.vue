<script lang="ts" setup>
import { ref } from 'vue'
import TopBar from '@/components/auramind/TopBar.vue'
import WorkspaceView from '@/components/auramind/WorkspaceView.vue'
import LibraryView from '@/components/auramind/LibraryView.vue'
import SettingsView from '@/components/auramind/SettingsView.vue'

const currentView = ref('workspace')

function navigate(view: string) {
  currentView.value = view
}
</script>

<template>
  <div class="h-full w-full bg-[#FAFAFA] soft-shadow border border-zinc-200 overflow-hidden flex flex-col font-sans text-zinc-900">
    <TopBar :current-view="currentView" @navigate="navigate" />

    <WorkspaceView v-show="currentView === 'workspace'" />
    <LibraryView v-show="currentView === 'library'" />
    <SettingsView v-show="currentView === 'settings'" />
  </div>
</template>
