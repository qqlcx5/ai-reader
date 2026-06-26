import { describe, it, expect } from 'vitest'
import { AppError } from './types'
import type { AppErrorCode } from './types'

const ALL_CODES: AppErrorCode[] = [
  'NO_ACTIVE_TAB',
  'UNSUPPORTED_PAGE',
  'PERMISSION_DENIED',
  'CONTENT_SCRIPT_FAILED',
  'EXTRACTION_FAILED',
  'MARKDOWN_FAILED',
  'INDEXEDDB_FAILED',
  'CLIPBOARD_FAILED',
  'UNKNOWN_ERROR',
]

const EXPECTED_MESSAGES: Record<AppErrorCode, string> = {
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

describe('AppError', () => {
  it('should be an instance of Error', () => {
    const err = new AppError('UNKNOWN_ERROR', 'test')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AppError)
  })

  it('should have correct name property', () => {
    const err = new AppError('UNKNOWN_ERROR', 'test')
    expect(err.name).toBe('AppError')
  })

  it('should store code and message', () => {
    const err = new AppError('EXTRACTION_FAILED', 'extraction failed')
    expect(err.code).toBe('EXTRACTION_FAILED')
    expect(err.message).toBe('extraction failed')
  })

  it('should store optional cause', () => {
    const cause = new Error('root cause')
    const err = new AppError('INDEXEDDB_FAILED', 'db error', cause)
    expect(err.cause).toBe(cause)
  })

  it('should have undefined cause when not provided', () => {
    const err = new AppError('NO_ACTIVE_TAB', 'no tab')
    expect(err.cause).toBeUndefined()
  })

  describe('toUserMessage()', () => {
    it.each(ALL_CODES)('should return correct message for %s', (code) => {
      const err = new AppError(code, 'internal message')
      expect(err.toUserMessage()).toBe(EXPECTED_MESSAGES[code])
    })
  })
})
