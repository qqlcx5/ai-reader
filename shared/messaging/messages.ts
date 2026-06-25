/**
 * 跨上下文消息协议定义
 * 参考 doc/tasks/foundation.md 章节 5
 * 参考 chrome-extensions skill 规则 #5：异步 onMessage 必须 return true
 */
import type { MessageMap, MessageEnvelope, MessageResponse } from '../types';

/**
 * 消息类型常量
 */
export const MessageType = {
  CAPTURE_PAGE: 'CAPTURE_PAGE',
  CAPTURE_RESULT: 'CAPTURE_RESULT',
  START_CHAT: 'START_CHAT',
  CHAT_STREAM_CHUNK: 'CHAT_STREAM_CHUNK',
  STOP_CHAT: 'STOP_CHAT',
  SEARCH_QUERY: 'SEARCH_QUERY',
  SEARCH_RESULTS: 'SEARCH_RESULTS',
  SYNC_UPLOAD: 'SYNC_UPLOAD',
  SYNC_DOWNLOAD: 'SYNC_DOWNLOAD',
  SYNC_STATUS: 'SYNC_STATUS',
  PING_MODEL: 'PING_MODEL',
  PING_RESULT: 'PING_RESULT',
  GET_DOCUMENT: 'GET_DOCUMENT',
  GET_DOCUMENT_RESULT: 'GET_DOCUMENT_RESULT',
  LIST_DOCUMENTS: 'LIST_DOCUMENTS',
  LIST_DOCUMENTS_RESULT: 'LIST_DOCUMENTS_RESULT',
  DELETE_DOCUMENT: 'DELETE_DOCUMENT',
} as const;

/**
 * 创建消息包装
 */
export function createEnvelope<T>(
  type: keyof MessageMap,
  payload: T,
  requestId?: string
): MessageEnvelope<T> {
  return {
    type,
    payload,
    requestId,
    timestamp: Date.now(),
  };
}

/**
 * 创建响应
 */
export function createResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  requestId?: string
): MessageResponse<T> {
  return { success, data, error, requestId };
}
