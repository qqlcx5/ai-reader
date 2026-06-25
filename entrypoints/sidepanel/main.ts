import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'virtual:uno.css';
import './style.css';
import App from './App.vue';

const app = createApp(App);
app.use(createPinia());

// 全局错误捕获 - 侧边栏报错时将详细信息打印到 console
app.config.errorHandler = (err, instance, info) => {
  console.error('[ReadChat sidepanel] Vue error:', err, '\nComponent:', instance, '\nInfo:', info);
  // 尝试在页面显示
  try {
    const root = document.getElementById('app');
    if (root && !root.querySelector('.readchat-error')) {
      const div = document.createElement('div');
      div.className = 'readchat-error';
      div.style.cssText = 'padding:16px;color:#dc2626;font-size:13px;background:#fee2e2;border:1px solid #fca5a5;border-radius:6px;margin:12px;';
      div.textContent = `[ReadChat] ${err instanceof Error ? err.message : String(err)}`;
      root.prepend(div);
    }
  } catch {}
};

window.addEventListener('error', (e) => {
  console.error('[ReadChat sidepanel] window error:', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[ReadChat sidepanel] unhandled rejection:', e.reason);
});

app.mount('#app');
