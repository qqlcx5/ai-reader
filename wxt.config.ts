import { defineConfig } from 'wxt';
import UnoCSS from 'unocss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'ReadChat',
    description: 'AI Reader Chrome Extension - 捕获网页、AI 对话、本地检索',
    permissions: ['sidePanel', 'storage', 'activeTab'],
    side_panel: {
      default_path: 'entrypoints/sidepanel/index.html',
    },
    action: {
      default_title: 'ReadChat - AI 阅读助手',
      default_popup: 'entrypoints/popup/index.html',
    },
    icons: {
      '16': 'icons/icon-16.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    // 手动添加 ISOLATED world content script
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content-bridge.js'],
        run_at: 'document_start',
      },
    ],
  },
  vite: () => ({
    plugins: [UnoCSS()],
  }),
});
