参考实际的项目技术实现目录结构

路径 reference/obsidian-clipper

### 5.1 源代码目录结构

```
src/
├── core/                           # UI 入口文件
│   ├── popup.ts                    # 弹窗入口
│   ├── settings.ts                 # 设置页面入口
│   ├── highlights.ts               # 高亮功能入口
│   └── reader-view.ts              # 阅读视图入口
│
├── utils/                          # 工具函数（~80 个模块）
│   ├── content-extraction.ts       # 内容提取
│   ├── template-compilation.ts     # 模板编译
│   ├── storage.ts                  # 存储管理
│   ├── browser-detection.ts        # 浏览器检测
│   ├── i18n.ts                     # 国际化
│   │
│   ├── filters/                    # 50+ 过滤器实现
│   │   ├── date.ts                 # 日期过滤器
│   │   ├── date.test.ts            # 日期过滤器测试
│   │   ├── camel.ts                # 驼峰命名过滤器
│   │   ├── kebab.ts                # 短横线命名过滤器
│   │   ├── join.ts                 # 数组连接过滤器
│   │   ├── split.ts                # 字符串分割过滤器
│   │   ├── replace.ts              # 替换过滤器
│   │   ├── markdown.ts             # Markdown 处理过滤器
│   │   ├── table.ts                # 表格过滤器
│   │   └── ...                     # 其他过滤器
│   │
│   ├── variables/                  # 变量解析器
│   │   ├── prompt.ts               # Prompt 变量（AI 驱动）
│   │   ├── schema.ts               # Schema.org 变量
│   │   ├── selector.ts             # CSS 选择器变量
│   │   └── simple.ts               # 预设变量
│   │
│   └── fixtures/                   # 测试固件
│       ├── youtube/                # YouTube 测试用例
│       ├── imdb/                   # IMDB 测试用例
│       └── goodreads/              # Goodreads 测试用例
│
├── managers/                       # UI 管理器
│   ├── template-manager.ts         # 模板管理
│   ├── highlights-manager.ts       # 高亮管理
│   ├── reader-manager.ts           # 阅读视图管理
│   ├── interpreter-manager.ts      # AI 解释器管理
│   ├── general-settings-manager.ts # 通用设置管理
│   ├── property-types-manager.ts   # 属性类型管理
│   └── menu-manager.ts            # 菜单管理
│
├── types/                          # 类型定义
│   └── types.ts                    # 核心类型
│
├── icons/                          # 图标资源
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
│
├── styles/                         # SCSS 样式
│   ├── popup.scss                  # 弹窗样式
│   ├── settings.scss               # 设置页面样式
│   ├── reader.scss                 # 阅读视图样式
│   ├── side-panel.scss             # 侧边栏样式
│   ├── mobile.scss                 # 移动端样式
│   ├── modals.scss                 # 弹窗样式
│   ├── rtl.scss                    # RTL 布局样式
│   └── safari.scss                 # Safari 特定样式
│
├── _locales/                       # 国际化资源（35 种语言）
│   ├── en/
│   │   └── messages.json
│   ├── zh-CN/
│   │   └── messages.json
│   ├── zh-TW/
│   │   └── messages.json
│   ├── ja/
│   │   └── messages.json
│   └── ...                         # 其他语言
│
├── manifest.chrome.json            # Chrome 扩展清单
├── manifest.firefox.json           # Firefox 扩展清单
└── manifest.safari.json            # Safari 扩展清单
```
