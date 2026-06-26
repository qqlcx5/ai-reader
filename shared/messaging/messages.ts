/** Background ↔ Content / SidePanel 消息类型枚举 */
export enum MessageType {
  // 捕获层
  CAPTURE_PAGE = 'CAPTURE_PAGE',
  CAPTURE_RESULT = 'CAPTURE_RESULT',

  // 处理层 - Chat
  START_CHAT_STREAM = 'START_CHAT_STREAM',
  STREAM_DELTA = 'STREAM_DELTA',
  STREAM_DONE = 'STREAM_DONE',
  STREAM_ERROR = 'STREAM_ERROR',
  STOP_CHAT_STREAM = 'STOP_CHAT_STREAM',

  // 唤醒层 - Search
  SEARCH_QUERY = 'SEARCH_QUERY',
  SEARCH_RESULT = 'SEARCH_RESULT',
  INDEX_READY = 'INDEX_READY',
  UPSERT_DOCUMENT = 'UPSERT_DOCUMENT',
  REMOVE_DOCUMENT = 'REMOVE_DOCUMENT',

  // 记忆层 - Sync
  SYNC_UPLOAD = 'SYNC_UPLOAD',
  SYNC_DOWNLOAD = 'SYNC_DOWNLOAD',
  SYNC_STATUS = 'SYNC_STATUS',

  // 通用
  OPEN_SIDE_PANEL = 'OPEN_SIDE_PANEL',
  GET_CURRENT_DOCUMENT = 'GET_CURRENT_DOCUMENT',
}

export interface BaseMessage {
  type: MessageType;
}

export interface CapturePageMessage extends BaseMessage {
  type: MessageType.CAPTURE_PAGE;
  tabId?: number;
}

export interface CaptureResultMessage extends BaseMessage {
  type: MessageType.CAPTURE_RESULT;
  documentId: string;
}

export interface StartChatStreamMessage extends BaseMessage {
  type: MessageType.START_CHAT_STREAM;
  documentId: string;
  question: string;
  modelId: string;
  portName: string;
}

export interface StreamDeltaMessage extends BaseMessage {
  type: MessageType.STREAM_DELTA;
  delta: string;
}

export interface StreamDoneMessage extends BaseMessage {
  type: MessageType.STREAM_DONE;
}

export interface StreamErrorMessage extends BaseMessage {
  type: MessageType.STREAM_ERROR;
  error: string;
}

export interface StopChatStreamMessage extends BaseMessage {
  type: MessageType.STOP_CHAT_STREAM;
}

export interface OpenSidePanelMessage extends BaseMessage {
  type: MessageType.OPEN_SIDE_PANEL;
  documentId?: string;
}

export type ExtensionMessage =
  | CapturePageMessage
  | CaptureResultMessage
  | StartChatStreamMessage
  | StreamDeltaMessage
  | StreamDoneMessage
  | StreamErrorMessage
  | StopChatStreamMessage
  | OpenSidePanelMessage;
