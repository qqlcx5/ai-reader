import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { getProvider } from '@/utils/llm';
import type { ProviderConfig } from '@/utils/llm/types';

export default defineBackground(() => {
  // Open side panel when extension icon is clicked
  browser.action.onClicked.addListener((tab) => {
    if (tab.id) {
      browser.sidePanel.open({ tabId: tab.id });
    }
  });

  // Message router: relay messages between popup/sidepanel and content scripts
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'extractContent') {
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]?.id) {
          browser.tabs.sendMessage(tabs[0].id, message).then(sendResponse).catch(() => {});
        }
      });
      return true; // async response
    }
  });

  // Keyboard shortcuts
  if (browser.commands) {
    browser.commands.onCommand.addListener(async (command) => {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) return;

      switch (command) {
        case 'summarize':
          browser.runtime.sendMessage({ action: 'shortcut', command: 'summarize' }).catch(() => {});
          break;
        case 'toggle-panel':
          browser.sidePanel.open({ tabId: tab.id });
          break;
        case 'abort-all':
          browser.runtime.sendMessage({ action: 'shortcut', command: 'abort-all' }).catch(() => {});
          break;
      }
    });
  }

  // Port-based streaming for LLM requests
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'llm-stream') return;

    port.onMessage.addListener((msg) => {
      if (msg.action === 'start') {
        const { providerId, config, prompt } = msg as {
          providerId: string;
          config: ProviderConfig;
          prompt: string;
        };

        const controller = new AbortController();

        const provider = getProvider(providerId);
        provider.stream(config, {
          prompt,
          signal: controller.signal,
          onDelta: (text) => {
            try { port.postMessage({ type: 'delta', text }); } catch {}
          },
          onDone: () => {
            try { port.postMessage({ type: 'done' }); } catch {}
          },
          onError: (err) => {
            try { port.postMessage({ type: 'error', error: err }); } catch {}
          },
        });

        port.onDisconnect.addListener(() => controller.abort());
      }

      if (msg.action === 'abort') {
        port.disconnect();
      }
    });
  });
});
