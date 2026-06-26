// ============================================================
// PageMind — Shared Domain Types & Error Definitions
// ============================================================

// ---- Article ----

export interface Article {
  id: string
  title: string
  url: string
  siteName?: string
  siteLetter?: string
  author?: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
  excerpt?: string
  markdown: string
  contentHtml?: string
  contentText?: string
  faviconUrl?: string
  image?: string
  readingTime?: number
}

// ---- Extraction ----

export interface ExtractResult {
  title: string
  url: string
  siteName?: string
  author?: string
  publishedAt?: string
  excerpt?: string
  contentHtml?: string
  contentText?: string
  markdown?: string
  image?: string
  readingTime?: number
}

// ---- Page Metadata ----

export interface PageMetadata {
  title: string
  url: string
  siteName?: string
  author?: string
  publishedAt?: string
  description?: string
  faviconUrl?: string
  lang?: string
}

// ---- Settings ----

export interface AppSettings {
  autoSave: boolean
  showToast: boolean
  includeFrontmatter: boolean
  readerStyle: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoSave: true,
  showToast: true,
  includeFrontmatter: true,
  readerStyle: true,
}

// ---- Errors ----

export type AppErrorCode =
  | 'NO_ACTIVE_TAB'
  | 'UNSUPPORTED_PAGE'
  | 'PERMISSION_DENIED'
  | 'CONTENT_SCRIPT_FAILED'
  | 'EXTRACTION_FAILED'
  | 'MARKDOWN_FAILED'
  | 'INDEXEDDB_FAILED'
  | 'CLIPBOARD_FAILED'
  | 'UNKNOWN_ERROR'

const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  NO_ACTIVE_TAB: '未找到当前页面',
  UNSUPPORTED_PAGE: '当前页面不支持提取',
  PERMISSION_DENIED: '需要当前站点访问权限',
  CONTENT_SCRIPT_FAILED: '内容脚本加载失败',
  EXTRACTION_FAILED: '正文提取失败，请重试',
  MARKDOWN_FAILED: 'Markdown 生成失败',
  INDEXEDDB_FAILED: '本地存储不可用',
  CLIPBOARD_FAILED: '当前环境不允许复制',
  UNKNOWN_ERROR: '发生未知错误',
}

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly cause?: Error

  constructor(code: AppErrorCode, message: string, cause?: Error) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.cause = cause
  }

  toUserMessage(): string {
    return ERROR_MESSAGES[this.code]
  }
}

// ---- Capture Step ----

export type CaptureStep = 'idle' | 'extracting' | 'markdown' | 'saving' | 'success' | 'error'

// ---- Toast ----

export interface ToastType {
  type: 'success' | 'error' | 'info'
  title: string
  description?: string
  duration?: number
}

// ---- Popup View ----

export type PopupView = 'capture' | 'library' | 'reader' | 'settings'

// ---- Messaging ----

export type MessageAction =
  | { type: 'GET_ACTIVE_TAB' }
  | { type: 'EXTRACT_PAGE'; tabId: number }
  | { type: 'PING' }
  | { type: 'COPY_MARKDOWN'; text: string }
