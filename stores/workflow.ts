import { defineStore } from 'pinia';
import { ref, watch, toRaw } from 'vue';
import { browser } from 'wxt/browser';
import type { WorkMode, RoleConfig, ChainStepConfig } from '@/utils/llm/types';
import { useComparisonStore } from './comparison';
import { useSettingsStore } from './settings';

const ROLES_KEY = 'ai-reader-roles';
const CHAIN_KEY = 'ai-reader-chain-steps';

const DEFAULT_ROLES: RoleConfig[] = [
  {
    id: 'role-critic',
    name: '红队挑刺专家',
    prompt: '你是一个严格的批判性分析师。请找出这篇文章中的逻辑漏洞、未经证实的断言和潜在偏见。',
    color: '#ef4444',
    providerId: 'openai',
  },
  {
    id: 'role-bull',
    name: '乐观支持者',
    prompt: '你是一个善于发现价值的分析师。请总结这篇文章中最有价值的洞见和积极因素。',
    color: '#22c55e',
    providerId: 'anthropic',
  },
];

const DEFAULT_CHAIN_STEPS: ChainStepConfig[] = [
  {
    id: 'chain-extract',
    providerId: 'openai',
    modelId: '',
    prompt: '请从以下文章中提炼出所有关键术语和技术概念，用简洁的列表形式输出。',
  },
  {
    id: 'chain-analyze',
    providerId: 'anthropic',
    modelId: '',
    prompt: '基于上一步提炼的术语，请对文章内容进行深度分析，给出你的独立见解。',
  },
];

export const useWorkflowStore = defineStore('workflow', () => {
  const workMode = ref<WorkMode>('parallel');
  const roles = ref<RoleConfig[]>([]);
  const chainSteps = ref<ChainStepConfig[]>([]);
  const chainSlotIndex = ref(0);
  const ready = ref(false);

  async function load() {
    try {
      const data = await browser.storage.local.get([ROLES_KEY, CHAIN_KEY]);
      const savedRoles = data[ROLES_KEY] as RoleConfig[] | undefined;
      const savedChain = data[CHAIN_KEY] as ChainStepConfig[] | undefined;

      roles.value = savedRoles && savedRoles.length > 0 ? savedRoles : [...DEFAULT_ROLES];
      chainSteps.value = savedChain && savedChain.length > 0 ? savedChain : [...DEFAULT_CHAIN_STEPS];

      // Fill in modelId from settings if empty
      const settings = useSettingsStore();
      for (const step of chainSteps.value) {
        if (!step.modelId) {
          const config = settings.getProviderConfig(step.providerId);
          step.modelId = config.model;
        }
      }
    } catch {
      roles.value = [...DEFAULT_ROLES];
      chainSteps.value = [...DEFAULT_CHAIN_STEPS];
    }
    ready.value = true;
  }

  async function save() {
    try {
      const plainRoles = toRaw(roles.value).map(r => ({ ...toRaw(r) }));
      const plainChain = toRaw(chainSteps.value).map(s => ({ ...toRaw(s) }));
      await browser.storage.local.set({
        [ROLES_KEY]: plainRoles,
        [CHAIN_KEY]: plainChain,
      });
    } catch {}
  }

  function setMode(mode: WorkMode) {
    if (workMode.value === mode) return;
    // Abort any in-flight streams and clear slots
    const comparison = useComparisonStore();
    comparison.abortAll();
    comparison.clearAll();
    workMode.value = mode;
    chainSlotIndex.value = 0;
  }

  function addRole(): RoleConfig {
    const role: RoleConfig = {
      id: 'role-' + Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: '新角色',
      prompt: '',
      color: '#6366f1',
      providerId: 'openai',
    };
    roles.value.push(role);
    return role;
  }

  function removeRole(id: string) {
    const idx = roles.value.findIndex(r => r.id === id);
    if (idx >= 0) roles.value.splice(idx, 1);
  }

  function updateRole(id: string, updates: Partial<Omit<RoleConfig, 'id'>>) {
    const idx = roles.value.findIndex(r => r.id === id);
    if (idx >= 0) {
      roles.value[idx] = { ...roles.value[idx], ...updates };
    }
  }

  function addChainStep(): ChainStepConfig {
    const settings = useSettingsStore();
    const firstProvider = settings.enabledProviders[0] || 'openai';
    const config = settings.getProviderConfig(firstProvider);
    const step: ChainStepConfig = {
      id: 'chain-' + Date.now().toString(36) + Math.random().toString(36).slice(2),
      providerId: firstProvider,
      modelId: config.model,
      prompt: '',
    };
    chainSteps.value.push(step);
    return step;
  }

  function removeChainStep(id: string) {
    const idx = chainSteps.value.findIndex(s => s.id === id);
    if (idx >= 0) chainSteps.value.splice(idx, 1);
  }

  function updateChainStep(id: string, updates: Partial<Omit<ChainStepConfig, 'id'>>) {
    const idx = chainSteps.value.findIndex(s => s.id === id);
    if (idx >= 0) {
      chainSteps.value[idx] = { ...chainSteps.value[idx], ...updates };
    }
  }

  function moveChainStep(id: string, direction: 'up' | 'down') {
    const idx = chainSteps.value.findIndex(s => s.id === id);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= chainSteps.value.length) return;
    const tmp = chainSteps.value[idx];
    chainSteps.value[idx] = chainSteps.value[targetIdx];
    chainSteps.value[targetIdx] = tmp;
  }

  // Debounced auto-save
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  watch([roles, chainSteps], () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(save, 500);
  }, { deep: true });

  // Load on init
  load();

  return {
    workMode,
    roles,
    chainSteps,
    chainSlotIndex,
    ready,
    load,
    save,
    setMode,
    addRole,
    removeRole,
    updateRole,
    addChainStep,
    removeChainStep,
    updateChainStep,
    moveChainStep,
  };
});
