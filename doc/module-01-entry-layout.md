---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d270bcd3df6a2cd27c2792fa9a0b45ef_fe1407e16d8e11f1aa625254006c9bbf
    ReservedCode1: jqKSAkaixGbBqJm0YiNZQUMlxRct/fy+eqd4EGBKfFMqUqhW6RM8Kr8EGkgho8dVyPtrK6+jpNypRzSGWrFymZb2Qa1xTyKgDUB1wECCUH+VmWVP7USlMBH8JwcIwxBiUq+c2wQjSMfgsHNoaUn6C/9YNPfEQqkuFN8Hc+RwYucAC9M3HSn5NqD2S8o=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d270bcd3df6a2cd27c2792fa9a0b45ef_fe1407e16d8e11f1aa625254006c9bbf
    ReservedCode2: jqKSAkaixGbBqJm0YiNZQUMlxRct/fy+eqd4EGBKfFMqUqhW6RM8Kr8EGkgho8dVyPtrK6+jpNypRzSGWrFymZb2Qa1xTyKgDUB1wECCUH+VmWVP7USlMBH8JwcIwxBiUq+c2wQjSMfgsHNoaUn6C/9YNPfEQqkuFN8Hc+RwYucAC9M3HSn5NqD2S8o=
---

# 模块 01：系统入口与布局

> 对应设计文档：design-01-entry-layout.md

## 子任务清单

- [ ] 子任务 1：搭建 WXT + Vue 3 项目骨架，配置 `manifest.json` 的 `action.default_popup`、`side_panel.default_path`、`options_ui` 三项入口声明
- [ ] 子任务 2：实现 Popup 浮层入口（380x500），包含 Header + Chat Workspace 紧凑模式 + Input Composer 三区域布局
- [ ] 子任务 3：实现 Side Panel 侧边栏入口（默认 400px 可拖拽），包含 StatusBar + Chat Workspace 完整模式 + Input Composer + 数据透视底栏四区域布局
- [ ] 子任务 4：实现 Options 独立管理页，分 Tab 布局承载 Provider 管理、提示词模板、RSS 订阅、缓存管理等子页面
- [ ] 子任务 5：注册三个全局快捷键：`Alt+S` 唤起 Side Panel / `Alt+P` 打开 Popup / `Escape` 中止所有网络请求并关闭浮层
- [ ] 子任务 6：实现 StatusBar 组件，从 `chrome.tabs.query` 获取当前 Tab 标题，从 M7 读取上下文状态（未提取/提取中/已提取+字数+时间），支持「⟳ 刷新提取当前 Tab」按钮
- [ ] 子任务 7：处理无权限页面（如 `chrome://extensions/`）显示「当前页面不支持提取」
- [ ] 子任务 8：实现 Background Service Worker 消息中枢，定义 `MessageType` 枚举（EXTRACT_PAGE / CHAT_REQUEST / ABORT_ALL_REQUESTS / UPDATE_BADGE / TAB_ACTIVATED / CONTEXT_STATUS_CHANGED / SHORTCUT_EVENT），按类型路由到对应模块
- [ ] 子任务 9：实现 Side Panel 与 Popup 切换逻辑：Popup 关闭时对话状态已持久化在 M7；Side Panel 重新打开时自动恢复上次会话；Popup 多模型模式下仅显示第一个模型并提示切换到 Side Panel
- [ ] 子任务 10：实现 `components/layout/` 目录下 8 个组件：PopupApp / SidePanelApp / OptionsApp / StatusBar / AppHeader / ToastProvider / ConfirmDialog / KeyboardShortcuts
- [ ] 子任务 11：集成 UnoCSS（Atomic CSS + attributify preset）+ CSS Variables 主题系统 + 暗色模式自动跟随 `prefers-color-scheme`，Options 中可手动切换
- [ ] 子任务 12：编写快捷键注册与去冲突逻辑的单元测试、Popup/Side Panel 切换集成测试、`Alt+S`/`Alt+P`/`Escape` E2E 测试
*（内容由AI生成，仅供参考）*
