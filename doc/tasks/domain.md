# domain — Shared Domain Types & Error Definitions

> 详细设计参考：doc/detail.md §3.5 (Article 数据结构)、§8 (错误设计)

---

## 任务清单

- [ ] 定义 `Article` 接口（id, title, url, siteName, siteLetter, author, publishedAt, createdAt, updatedAt, excerpt, markdown, faviconUrl, image, readingTime）
- [ ] 定义 `ExtractResult` 接口（title, url, siteName, author, publishedAt, excerpt, contentHtml, contentText, image, readingTime）
- [ ] 定义 `PageMetadata` 接口（title, url, siteName, author, publishedAt, description, faviconUrl, lang）
- [ ] 定义 `AppSettings` 接口（autoSave, showToast, includeFrontmatter, readerStyle）及默认值常量 `DEFAULT_SETTINGS`
- [ ] 定义 `AppErrorCode` 类型（NO_ACTIVE_TAB, UNSUPPORTED_PAGE, PERMISSION_DENIED, CONTENT_SCRIPT_FAILED, EXTRACTION_FAILED, MARKDOWN_FAILED, INDEXEDDB_FAILED, CLIPBOARD_FAILED, UNKNOWN_ERROR）
- [ ] 定义 `AppError` 类（code: AppErrorCode, message: string, cause?: Error），提供 `toUserMessage()` 方法返回中文提示
- [ ] 定义 `CaptureStep` 类型（idle, extracting, markdown, saving, success, error）
- [ ] 定义 `ToastType` 接口（type: success | error | info, title, description?, duration?）
- [ ] 定义 `PopupView` 类型（capture, library, reader, settings）
- [ ] 定义消息类型 `MessageAction` 联合类型（GET_ACTIVE_TAB, EXTRACT_PAGE, PING, COPY_MARKDOWN）
- [ ] 导出所有类型作为 barrel export（`domain/index.ts`）
- [ ] 编写单元测试：AppError.toUserMessage() 覆盖所有错误码

## 验收标准

- 所有类型从 `@/domain` 统一导出
- AppSettings DEFAULT_SETTINGS 包含全部 4 个字段的合理默认值
- AppError 每个 code 都有对应的中文用户提示
