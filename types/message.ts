import type { ExtractionMethod } from './document'

export enum MessageType {
  TAB_ACTIVATED = 'TAB_ACTIVATED',
  TAB_UPDATED = 'TAB_UPDATED',
  GET_CURRENT_TAB = 'GET_CURRENT_TAB',
  EXTRACT_PAGE = 'EXTRACT_PAGE',
  PAGE_EXTRACTED = 'PAGE_EXTRACTED',
  EXTRACT_ERROR = 'EXTRACT_ERROR',
  PAGE_UPDATED = 'PAGE_UPDATED',
}

export interface TabInfo {
  id: number
  url: string
  title: string
  favIconUrl?: string
}

export interface TabActivatedPayload {
  tab: TabInfo
}

export interface TabUpdatedPayload {
  tab: TabInfo
}

export interface GetCurrentTabPayload {
  // empty payload
}

export interface ExtractPagePayload {
  tabId: number
}

export interface PageExtractedPayload {
  url: string
  title: string
  markdown: string
  siteName?: string
  author?: string
  description?: string
  publishedAt?: string
  canonicalUrl?: string
  contentHash: string
  wordCount: number
  tokenCount: number
  extractionMethod: ExtractionMethod
  sanitizedHtml?: string
}

export interface ExtractErrorPayload {
  error: string
}

export interface PageUpdatedPayload {
  url: string
  title: string
}

export type MessagePayload =
  | TabActivatedPayload
  | TabUpdatedPayload
  | GetCurrentTabPayload
  | ExtractPagePayload
  | PageExtractedPayload
  | ExtractErrorPayload
  | PageUpdatedPayload

export interface MessageEnvelope<T extends MessagePayload = MessagePayload> {
  type: MessageType
  payload: T
}
