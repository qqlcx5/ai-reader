import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useWorkflowStore } from '@/stores/workflow';
import { useSettingsStore } from '@/stores/settings';

// Mock browser storage
const mockStorage: Record<string, any> = {};

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[]) => {
          const keysArr = Array.isArray(keys) ? keys : [keys];
          const result: Record<string, any> = {};
          for (const k of keysArr) {
            if (k in mockStorage) result[k] = mockStorage[k];
          }
          return result;
        }),
        set: vi.fn(async (data: Record<string, any>) => {
          Object.assign(mockStorage, data);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const keysArr = Array.isArray(keys) ? keys : [keys];
          for (const k of keysArr) delete mockStorage[k];
        }),
      },
    },
    runtime: {
      connect: vi.fn(),
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
}));

describe('useWorkflowStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Clear mock storage
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  });

  describe('initial load', () => {
    it('should load default roles on first load', async () => {
      const store = useWorkflowStore();
      await store.load();
      expect(store.roles.length).toBe(2);
      expect(store.roles[0].name).toBe('红队挑刺专家');
      expect(store.roles[0].color).toBe('#ef4444');
      expect(store.roles[1].name).toBe('乐观支持者');
      expect(store.roles[1].color).toBe('#22c55e');
    });

    it('should load default chain steps on first load', async () => {
      const store = useWorkflowStore();
      await store.load();
      expect(store.chainSteps.length).toBe(2);
      expect(store.chainSteps[0].prompt).toContain('术语');
      expect(store.chainSteps[1].prompt).toContain('深度分析');
    });

    it('should load saved roles from storage', async () => {
      mockStorage['ai-reader-roles'] = [
        { id: 'r1', name: 'Custom Role', prompt: 'test', color: '#000', providerId: 'openai' },
      ];
      const store = useWorkflowStore();
      await store.load();
      expect(store.roles.length).toBe(1);
      expect(store.roles[0].name).toBe('Custom Role');
    });

    it('should load saved chain steps from storage', async () => {
      mockStorage['ai-reader-chain-steps'] = [
        { id: 'c1', providerId: 'openai', modelId: 'gpt-4o', prompt: 'test step' },
      ];
      const store = useWorkflowStore();
      await store.load();
      expect(store.chainSteps.length).toBe(1);
      expect(store.chainSteps[0].prompt).toBe('test step');
    });
  });

  describe('work mode', () => {
    it('should default to parallel mode', () => {
      const store = useWorkflowStore();
      expect(store.workMode).toBe('parallel');
    });

    it('should switch mode', () => {
      const store = useWorkflowStore();
      store.setMode('roundtable');
      expect(store.workMode).toBe('roundtable');
      store.setMode('chain');
      expect(store.workMode).toBe('chain');
    });
  });

  describe('role CRUD', () => {
    it('should add a role', async () => {
      const store = useWorkflowStore();
      await store.load();
      const initialCount = store.roles.length;
      const role = store.addRole();
      expect(store.roles.length).toBe(initialCount + 1);
      expect(role.name).toBe('新角色');
      expect(role.id).toBeTruthy();
    });

    it('should update a role', async () => {
      const store = useWorkflowStore();
      await store.load();
      const roleId = store.roles[0].id;
      store.updateRole(roleId, { name: 'Updated Name', color: '#ff0000' });
      expect(store.roles[0].name).toBe('Updated Name');
      expect(store.roles[0].color).toBe('#ff0000');
    });

    it('should remove a role', async () => {
      const store = useWorkflowStore();
      await store.load();
      const initialCount = store.roles.length;
      const roleId = store.roles[0].id;
      store.removeRole(roleId);
      expect(store.roles.length).toBe(initialCount - 1);
    });
  });

  describe('chain step CRUD', () => {
    it('should add a chain step', async () => {
      const store = useWorkflowStore();
      await store.load();
      const initialCount = store.chainSteps.length;
      const step = store.addChainStep();
      expect(store.chainSteps.length).toBe(initialCount + 1);
      expect(step.id).toBeTruthy();
    });

    it('should update a chain step', async () => {
      const store = useWorkflowStore();
      await store.load();
      const stepId = store.chainSteps[0].id;
      store.updateChainStep(stepId, { prompt: 'Updated prompt' });
      expect(store.chainSteps[0].prompt).toBe('Updated prompt');
    });

    it('should remove a chain step', async () => {
      const store = useWorkflowStore();
      await store.load();
      const initialCount = store.chainSteps.length;
      const stepId = store.chainSteps[0].id;
      store.removeChainStep(stepId);
      expect(store.chainSteps.length).toBe(initialCount - 1);
    });

    it('should move chain step up', async () => {
      const store = useWorkflowStore();
      await store.load();
      const firstId = store.chainSteps[0].id;
      store.moveChainStep(firstId, 'up');
      // First step should still be first (can't move up)
      expect(store.chainSteps[0].id).toBe(firstId);
    });

    it('should move chain step down', async () => {
      const store = useWorkflowStore();
      await store.load();
      const firstId = store.chainSteps[0].id;
      store.moveChainStep(firstId, 'down');
      // First step should now be second
      expect(store.chainSteps[1].id).toBe(firstId);
    });
  });

  describe('persistence', () => {
    it('should save to storage', async () => {
      const store = useWorkflowStore();
      await store.load();
      store.addRole();
      // Wait for debounced save
      await new Promise(resolve => setTimeout(resolve, 600));
      expect(mockStorage['ai-reader-roles']).toBeDefined();
      expect(mockStorage['ai-reader-roles'].length).toBe(3);
    });
  });
});
