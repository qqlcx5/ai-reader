/**
 * Service Worker 入口
 * 参考 doc/tasks/foundation.md 章节 1, 2, 5
 * 参考 doc/tasks/chat-with-doc.md 章节 3, 7
 * 参考 chrome-extensions skill 规则 #7：SW 是 ephemeral，状态用 chrome.storage
 */
import { defineBackground } from 'wxt/utils/define-background';
import { onMessage } from '@/shared/messaging/runtime-client';
import { MessageType } from '@/shared/messaging/messages';
import { saveCapturedDocument } from '@/core/documents/document-service';
import { startChat } from '@/core/chat/chat-service';
import { listDocuments, getDocument, deleteDocument } from '@/db/document-repository';
import { getModel } from '@/db/model-repository';
import { pingModel } from '@/core/models/openai-compat.adapter';
import { setSession } from '@/stores/storage';

// 流式状态：临时 session 存储
const STREAMING_STATE = 'streaming_state';
// 当前活跃的 AbortController（用于停止）
const streamingControllers = new Map<string, AbortController>();

export default defineBackground(() => {
  console.log('[ReadChat] background loaded');

  // ========== 1. Side Panel 打开触发器 ==========
  // 参考 chrome-extensions skill 规则 #2 + foundation.md 章节 1
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  });

  // ========== 2. 安装时初始化 ==========
  chrome.runtime.onInstalled.addListener(() => {
    // 配置 side_panel 行为
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.error('[ReadChat] setPanelBehavior:', err));
  });

  // ========== 3. 消息路由 ==========
  onMessage(async (envelope, _sender) => {
    const { type, payload } = envelope;
    try {
      switch (type) {
        case MessageType.CAPTURE_PAGE: {
          // 转发给当前 tab 的 content script
          // payload: { tabId: number }
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id) {
            await chrome.tabs.sendMessage(tabs[0].id, envelope);
          }
          return { success: true };
        }
        case MessageType.START_CHAT: {
          // 流式聊天 - 通过 port 转发
          // 这里简化：直接调用 startChat（chrome.storage.session 持久化）
          const p = payload as { documentId: string; question: string; modelId?: string };
          await setSession(`${STREAMING_STATE}::${p.documentId}`, { active: true });
          const controller = new AbortController();
          streamingControllers.set(p.documentId, controller);
          try {
            await startChat({
              documentId: p.documentId,
              question: p.question,
              modelId: p.modelId,
              onChunk: async (delta, done) => {
                // 通知 sidepanel
                try {
                  await chrome.runtime.sendMessage({
                    type: MessageType.CHAT_STREAM_CHUNK,
                    payload: {
                      documentId: p.documentId,
                      delta,
                      done,
                    },
                  });
                } catch {
                  // sidepanel 未打开
                }
              },
              signal: controller.signal,
            });
          } finally {
            streamingControllers.delete(p.documentId);
            await setSession(`${STREAMING_STATE}::${p.documentId}`, { active: false });
          }
          return { success: true };
        }
        case MessageType.STOP_CHAT: {
          const p = payload as { documentId: string };
          const c = streamingControllers.get(p.documentId);
          if (c) {
            c.abort();
            streamingControllers.delete(p.documentId);
          }
          return { success: true };
        }
        case MessageType.PING_MODEL: {
          const p = payload as { modelId: string };
          const model = await getModel(p.modelId);
          if (!model) return { success: false, error: 'Model not found' };
          return await pingModel(model);
        }
        case MessageType.LIST_DOCUMENTS: {
          const p = (payload as { limit?: number; offset?: number }) || {};
          return await listDocuments(p.limit, p.offset);
        }
        case MessageType.GET_DOCUMENT: {
          const p = payload as { documentId: string };
          return { success: true, data: await getDocument(p.documentId) };
        }
        case MessageType.DELETE_DOCUMENT: {
          const p = payload as { documentId: string };
          await deleteDocument(p.documentId);
          return { success: true };
        }
        default:
          return { success: false, error: `Unknown message type: ${type}` };
      }
    } catch (err) {
      console.error('[ReadChat] background error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // ========== 4. 启动时预热索引 ==========
  chrome.runtime.onStartup.addListener(async () => {
    try {
      const { initIndex } = await import('@/core/search/index-coordinator');
      await initIndex();
    } catch (err) {
      console.warn('[ReadChat] initIndex on startup failed:', err);
    }
  });
});
