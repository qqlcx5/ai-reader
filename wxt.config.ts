import { defineConfig } from 'wxt'
import { resolve } from 'node:path';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue', '@wxt-dev/unocss'],
  manifest: {
    name: 'AuraMind - AI-Powered Web Clipper & Smart Reader',
    version: '0.1.0',
    short_name: 'AuraMind',
    description: 'AI-powered web clipper that summarizes, highlights, and turns pages into a spaced-repetition review feed. Local-first, sync via WebDAV/S3.',
    permissions: ['sidePanel', 'activeTab', 'scripting', 'storage', 'tabs', 'windows', 'alarms', 'offscreen'],
    host_permissions: ['<all_urls>', 'http://127.0.0.1/*', 'http://localhost/*'],
  },
  dev: {
    server: {
      port: 8080,
    },
  },
  // vite: () => ({
  //   build: {
  //     chunkSizeWarningLimit: 500,
  //     rollupOptions: {
  //       onwarn(warning, warn) {
  //         if (warning.code === 'INVALID_ANNOTATION') return
  //         warn(warning)
  //       },
  //     },
  //   },
  // }),
  webExt: {
    // Mac
    // chromiumProfile: './.wxt/chrome-data',
    // binaries: {
    //   chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    // },
    chromiumProfile: resolve('.wxt/chrome-data'),
    // chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
    keepProfileChanges: true,
    startUrls: ['https://www.bestblogs.dev/article/6bbe303e'],
    // 保持配置文件变更时重启浏览器
    openDevtools: true,
    openConsole: true
  },
})
