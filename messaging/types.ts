// ============================================================
// PageMind — Cross-Context Message Types
// ============================================================

import type { ExtractResult } from '@/domain'

// ---- Message Actions ----

export interface GetActiveTabMessage {
  type: 'GET_ACTIVE_TAB'
}

export interface ExtractPageMessage {
  type: 'EXTRACT_PAGE'
  tabId: number
}

export interface PingMessage {
  type: 'PING'
}

export interface CopyMarkdownMessage {
  type: 'COPY_MARKDOWN'
  text: string
}

export type MessageAction =
  | GetActiveTabMessage
  | ExtractPageMessage
  | PingMessage
  | CopyMarkdownMessage

// ---- Response Types ----

export interface ActiveTabInfo {
  tabId: number
  url: string
  title: string
}

export interface MessageResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
