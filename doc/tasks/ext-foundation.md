# 插件基础 (ext-foundation)

- [ ] WXT 工程初始化：创建 `wxt.config.ts`，配置 `srcDir`、`outDir`、`modules: ['@wxt-dev/module-vue', '@wxt-dev/unocss']`，生成 `package.json` 并执行 `npm install`
- [ ] Chrome Manifest 权限配置：在 `wxt.config.ts` 中声明 `permissions: ['sidePanel', 'activeTab', 'scripting', 'storage', 'tabs']`，`host_permissions: ['<all_urls>']`
- [ ] UnoCSS 配置：创建 `uno.config.ts`，使用 `presetWind3()`，自定义色板（primary/secondary/accent/surface）和字体（sans/mono）
- [ ] Reka UI 组件库二次封装：创建 `src/components/common/` 下 Switch / Slider / Select / Separator / RekaButton / RekaInput / RekaTextarea 的 Vue wrapper 组件
- [ ] Pinia 初始化：`src/stores/` 下创建各 store 骨架文件（app / workspace / document / chat / model / settings），引入 `pinia-plugin-persistedstate`
- [ ] Dexie 数据库初始化：`src/db/schema.ts` 定义 v1 stores（documents / conversations / models / settings），`src/db/index.ts` 导出 db 实例，索引字段按 PRD 第 7 节
- [ ] background.ts：`src/entrypoints/background.ts` 实现 Side Panel 生命周期管理（`chrome.sidePanel.setPanelBehavior`），监听 `tabs.onActivated` / `tabs.onUpdated` 并广播 Tab 切换事件
- [ ] sidepanel 入口：创建 `src/entrypoints/sidepanel/index.html` / `main.ts` / `App.vue`，在 App.vue 中挂载 Pinia + 基础路由占位，确保 `wxt build` / `wxt dev` 无报错且 Chrome 可加载扩展
