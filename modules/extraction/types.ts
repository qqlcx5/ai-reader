/**
 * M2 — Context Extraction types
 */

export interface ExtractedContext {
  /** 当前页面 URL */
  url: string;
  /** 页面标题 */
  title: string;
  /** 站点域名 */
  siteName?: string;
  /** 提取时间戳 */
  extractedAt: number;
  /** 预估字数（中文字符 + 英文单词） */
  wordCount: number;
  /** 正文内容，Markdown 或纯文本 */
  content: string;
  /** 内容格式 */
  format: 'markdown' | 'text';
  /** 使用的提取器 */
  extractor: 'readability' | 'defuddle' | 'innerText';
  /** 原始 HTML 摘要，调试用 */
  htmlFingerprint?: string;
}

export interface ExtractRequest {
  type: 'EXTRACT_PAGE';
  /** 是否强制刷新（忽略缓存） */
  force: boolean;
  /** 期望输出格式 */
  preferredFormat: 'markdown' | 'text';
}

export interface ExtractResponse {
  type: 'EXTRACT_RESULT';
  success: boolean;
  context?: ExtractedContext;
  error?: {
    code: 'TIMEOUT' | 'EMPTY' | 'DOM_NOT_READY' | 'UNKNOWN';
    message: string;
  };
}

export interface ExtractOptions {
  /** 期望输出格式，默认 markdown */
  preferredFormat?: 'markdown' | 'text';
  /** 内容长度低于此值触发降级，默认 200 */
  minContentLength?: number;
  /** Defuddle 超时毫秒，默认 8000 */
  defuddleTimeoutMs?: number;
}

export interface ChunkedTransfer {
  transferId: string;
  totalChunks: number;
  chunkIndex: number;
  chunkData: string;
  isLast: boolean;
}

export interface ChunkRequest {
  type: 'REQUEST_CHUNK';
  transferId: string;
  chunkIndex: number;
}

export interface ChunkResponse {
  type: 'CHUNK_DATA';
  transferId: string;
  chunkIndex: number;
  chunkData: string;
  isLast: boolean;
}

export interface TransferMetaMessage {
  type: 'TRANSFER_META';
  transferId: string;
  totalChunks: number;
  totalSize: number;
}

export const MIN_CONTENT_LENGTH = 200;
export const CHUNK_SIZE = 1024 * 1024; // 1MB
export const DEFAULT_DEFUDDLE_TIMEOUT = 8000;
