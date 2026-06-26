// ============================================================
// PageMind — Popup-side Message Client
// ============================================================
// Promise-wrapped browser.runtime.sendMessage with timeout & error handling

import type { ExtractResult } from '@/domain'
import { AppError } from '@/domain'
import type { ActiveTabInfo, MessageResponse } from './types'

const MESSAGE_TIMEOUT = 10_000 // 10 seconds

/**
 * 发送消息并等待响应，统一超时和错误处理
 */
async function sendMessage<T>(message: { type: string; [key: string]: unknown }): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError('UNKNOWN_ERROR', `消息超时: ${message.type}`))
    }, MESSAGE_TIMEOUT)

    browser.runtime.sendMessage(message, (response: MessageResponse<T>) => {
      clearTimeout(timer)
      if (browser.runtime.lastError) {
        reject(new AppError('CONTENT_SCRIPT_FAILED', browser.runtime.lastError.message ?? '消息发送失败'))
        return
      }
      if (!response || !response.success) {
        reject(new AppError('UNKNOWN_ERROR', response?.error ?? '未知消息错误'))
        return
      }
      resolve(response.data as T)
    })
  })
}

/**
 * 获取当前活动 Tab 信息
 */
export async function getActiveTab(): Promise<ActiveTabInfo> {
  return sendMessage<ActiveTabInfo>({ type: 'GET_ACTIVE_TAB' })
}

/**
 * 触发 Content Script 提取页面并返回结果
 */
export async function extractPage(tabId: number): Promise<ExtractResult> {
  return sendMessage<ExtractResult>({ type: 'EXTRACT_PAGE', tabId })
}

/**
 * 复制 Markdown 到剪贴板
 */
export async function copyMarkdown(text: string): Promise<void> {
  await sendMessage<void>({ type: 'COPY_MARKDOWN', text })
}

/**
 * 测试消息通道是否通畅
 */
export async function ping(): Promise<boolean> {
  return sendMessage<boolean>({ type: 'PING' })
}
