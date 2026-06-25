// @ts-check
import { defineConfig } from 'wxt';
import UnoCSS from 'unocss/vite';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: '.',
  outDir: '.output',

  imports: {
    dirs: ['core', 'db', 'shared', 'stores', 'components'],
  },

  // @wxt-dev/module-vue 已提供 Vue 插件支持，无需手动添加 @vitejs/plugin-vue
  modules: ['@wxt-dev/module-vue'],

  manifestVersion: 3,

  manifest: {
    name: 'ReadChat',
    description: '捕获网页、对话 AI、搜索阅读',
    version: '0.1.0',

    permissions: [
      'sidePanel',
      'storage',
      'tabs',
      'scripting',
      'activeTab',
      'contextMenus',
    ],

    host_permissions: ['<all_urls>'],

    action: {
      default_title: 'Open ReadChat',
      // 不设 default_popup，否则会与 sidePanel.setPanelBehavior 冲突
      // 点击图标应由 background.ts 的 onClicked 监听器处理（打开 side panel）
    },

    side_panel: {
      default_path: 'sidepanel.html',
    },

    web_accessible_resources: [
      {
        resources: ['icon/*.png'],
        matches: ['<all_urls>'],
      },
    ],

    commands: {
      'capture-page': {
        suggested_key: {
          default: 'Alt+Shift+C',
        },
        description: '捕获当前页面到 ReadChat',
      },
    },
  },
  webExt: {
    // 持久化 profile 到项目目录下
    // 需要重置时，删除 .wxt/chrome-data 目录即可
    // 第一次启动需要手动加载扩展（chrome://extensions → 开发者模式 → 加载已解压 → 选 .output/chrome-mv3-dev）
    // 之后 dev 重启会保留
    chromiumProfile: './.wxt/chrome-data',
    keepProfileChanges: true,
    // 启动时自动在浏览器中打开以下页面
    openUrls: ['chrome://extensions', 'about:blank'],
  },
  vite: () => ({
    plugins: [
      UnoCSS(),
    ],
    resolve: {
      alias: {
        '@': '/',
      },
    },
  }),
});
