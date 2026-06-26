// ISOLATED world content script - 桥接 MAIN world 和 Background
// 监听 MAIN world 的 window.postMessage，转发到 chrome.runtime

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'ISOLATED',
  main() {
    console.log('ReadChat ISOLATED content script injected');

    window.addEventListener('message', (event) => {
      // 只接受来自同源的消息
      if (event.source !== window) return;

      if (event.data?.type === 'READCHAT_CAPTURE_RESULT') {
        // 转发到 background
        chrome.runtime.sendMessage({
          type: 'CAPTURE_PAGE',
          document: event.data.document,
        }).catch((err) => {
          console.error('Failed to send capture result to background:', err);
        });
      }
    });
  },
});
