import { defineConfig } from 'wxt'
import { resolve } from 'node:path';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue', '@wxt-dev/unocss'],
  manifest: {
    name: 'AuraMind',
    permissions: ['sidePanel', 'activeTab', 'scripting', 'storage', 'tabs', 'windows', 'alarms'],
    host_permissions: ['<all_urls>'],
  },
  // unocss: {
  //   excludeEntrypoints: ['background'],
  // },
  // dev: {
  //   server: {
  //     port: 3001,
  //   },
  // },
  vite: () => ({
    build: {
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === 'INVALID_ANNOTATION') return
          warn(warning)
        },
      },
    },
  }),
  webExt: {
    // Mac
    // chromiumProfile: './.wxt/chrome-data',
    // binaries: {
    //   chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    // },
    chromiumProfile: resolve('.wxt/chrome-data'),
    // chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
    keepProfileChanges: true,
    startUrls: ['https://www.bestblogs.dev/article/3ff37d3c'],
    // 保持配置文件变更时重启浏览器
    openDevtools: true,
    openConsole: true
  },
})
