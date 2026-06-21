import { createApp } from 'vue';
import { createPinia } from '@/stores';
import App from './App.vue';
import '@/styles/theme.css';

(async () => {
  const pinia = await createPinia();
  const app = createApp(App);
  app.use(pinia);
  app.mount('#app');
})();
