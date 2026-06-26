import { MessageType } from '@/shared/messaging/messages';
import { documentRepository } from '@/core/documents/document.repository';
import { streamChat, type ChatMessage } from '@/core/models/openai-compat.adapter';
import type { CapturedDocument } from '@/db/schema';

export default defineBackground(() => {
  console.log('ReadChat background service worker started');

  // 消息路由
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case MessageType.CAPTURE_PAGE:
        handleCapturePage(message, sender)
          .then(sendResponse)
          .catch((err) => sendResponse({ error: String(err) }));
        return true;

      case MessageType.OPEN_SIDE_PANEL:
        handleOpenSidePanel(message, sender);
        break;
    }
  });

  // 长连接处理（流式对话）
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'chat-stream') {
      port.onMessage.addListener((msg) => {
        if (msg.type === MessageType.START_CHAT_STREAM) {
          handleChatStream(port, msg);
        }
      });
    }
  });
});

async function handleCapturePage(
  message: { document?: CapturedDocument },
  sender: chrome.runtime.MessageSender,
) {
  const tabId = sender.tab?.id;
  if (!message.document) {
    return { error: 'No document data' };
  }

  const documentId = await documentRepository.put(message.document);

  if (tabId) {
    try {
      await chrome.sidePanel.open({ tabId });
    } catch (err) {
      console.error('Failed to open side panel:', err);
    }
  }

  return { success: true, documentId };
}

async function handleOpenSidePanel(
  _message: unknown,
  sender: chrome.runtime.MessageSender,
) {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  try {
    await chrome.sidePanel.open({ tabId });
  } catch (err) {
    console.error('Failed to open side panel:', err);
  }
}

async function handleChatStream(
  port: chrome.runtime.Port,
  msg: {
    messages: ChatMessage[];
    modelId: string;
    baseUrl: string;
    apiKey: string;
    model: string;
  },
) {
  const systemPrompt = msg.messages.find((m) => m.role === 'system')?.content;
  const nonSystemMessages = msg.messages.filter((m) => m.role !== 'system') as ChatMessage[];

  try {
    await streamChat(
      msg.baseUrl,
      msg.apiKey,
      msg.model,
      nonSystemMessages,
      {
        onDelta: (content) => {
          try {
            port.postMessage({ type: 'delta', content });
          } catch {
            // port disconnected
          }
        },
        onDone: () => {
          try {
            port.postMessage({ type: 'done' });
          } catch {
            // port disconnected
          }
        },
        onError: (error) => {
          try {
            port.postMessage({ type: 'error', error });
          } catch {
            // port disconnected
          }
        },
      },
      systemPrompt,
    );
  } catch (err) {
    try {
      port.postMessage({ type: 'error', error: String(err) });
    } catch {
      // port disconnected
    }
  }
}
