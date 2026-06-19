// More accurate simulation with Pinia-like store
import { ref, watch, reactive, toRaw } from 'vue';

const storage = {};
const browser = {
  storage: {
    local: {
      async get(key) {
        if (typeof key === 'string') return { [key]: storage[key] };
        return {};
      },
      async set(obj) {
        // Mimic structured clone - if there's an error, throw
        try {
          // JSON.stringify is similar to structured clone for plain data
          const clone = JSON.parse(JSON.stringify(obj));
          Object.assign(storage, clone);
          console.log('[storage.set] saved OK');
        } catch (e) {
          console.log('[storage.set] ERROR:', e.message);
          throw e;
        }
      },
    },
  },
};

const STORAGE_KEY = 'ai-reader-settings';

const DEFAULT_SETTINGS = {
  providers: {
    openai: { apiKey: '', baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' },
    anthropic: { apiKey: '', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
  },
  enabledProviders: ['openai'],
};

// EXACTLY mimic the user's code
function createStore() {
  const providers = ref({ ...DEFAULT_SETTINGS.providers });
  const enabledProviders = ref([...DEFAULT_SETTINGS.enabledProviders]);
  const ready = ref(false);

  async function load() {
    const data = await browser.storage.local.get(STORAGE_KEY);
    const saved = data[STORAGE_KEY];
    if (saved) {
      providers.value = { ...DEFAULT_SETTINGS.providers, ...saved.providers };
      enabledProviders.value = saved.enabledProviders || ['openai'];
    }
    ready.value = true;
  }

  async function save() {
    await browser.storage.local.set({
      [STORAGE_KEY]: {
        providers: providers.value,
        enabledProviders: enabledProviders.value,
      } satisfies ProviderSettings,
    });
  }

  function getProviderConfig(id) {
    return providers.value[id] || DEFAULT_SETTINGS.providers[id] || { apiKey: '', baseUrl: '', model: '' };
  }

  function updateProvider(id, config) {
    providers.value[id] = { ...getProviderConfig(id), ...config };
  }

  let saveTimeout = null;
  watch([providers, enabledProviders], () => {
    console.log('[watch] fired, scheduling save');
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(save, 500);
  }, { deep: true });

  load();

  return {
    providers,
    enabledProviders,
    ready,
    load,
    save,
    getProviderConfig,
    updateProvider,
  };
}

const store = createStore();

await new Promise(r => setTimeout(r, 100));

console.log('--- Test 1: Save new key ---');
store.updateProvider('openai', { apiKey: 'sk-newkey' });
await new Promise(r => setTimeout(r, 700));
console.log('Storage after save:', JSON.stringify(storage, null, 2));

console.log('\n--- Test 2: Reload store and check persistence ---');
storage; // reset for clarity
const store2 = createStore();
await new Promise(r => setTimeout(r, 200));
console.log('store2 openai.apiKey:', store2.providers.value.openai.apiKey);

console.log('\n--- Test 3: Update model ---');
store2.updateProvider('openai', { model: 'gpt-4o' });
await new Promise(r => setTimeout(r, 700));
console.log('Storage after model update:', JSON.stringify(storage, null, 2));

console.log('\n--- Test 4: Toggle provider ---');
// Just simulate the toggle function
const idx = store2.enabledProviders.value.indexOf('openai');
if (idx >= 0) store2.enabledProviders.value.splice(idx, 1);
else store2.enabledProviders.value.push('openai');
await new Promise(r => setTimeout(r, 700));
console.log('Storage after toggle:', JSON.stringify(storage, null, 2));
