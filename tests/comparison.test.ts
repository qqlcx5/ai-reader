import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useComparisonStore } from '@/stores/comparison';
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
      },
    },
    runtime: {
      connect: vi.fn(() => ({
        onMessage: { addListener: vi.fn() },
        onDisconnect: { addListener: vi.fn() },
        postMessage: vi.fn(),
        disconnect: vi.fn(),
      })),
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
}));

describe('useComparisonStore — roundtable & chain', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  });

  describe('roundtable mode', () => {
    it('should init slots with role metadata', () => {
      const comparison = useComparisonStore();
      const roles = [
        { id: 'r1', name: 'Critic', prompt: 'Be critical', color: '#ef4444', providerId: 'openai' },
        { id: 'r2', name: 'Fan', prompt: 'Be supportive', color: '#22c55e', providerId: 'anthropic' },
      ];
      comparison.initRoundtable(roles);

      expect(comparison.slots.length).toBe(2);
      expect(comparison.slots[0].roleName).toBe('Critic');
      expect(comparison.slots[0].roleColor).toBe('#ef4444');
      expect(comparison.slots[1].roleName).toBe('Fan');
      expect(comparison.slots[1].roleColor).toBe('#22c55e');
      expect(comparison.slots[0].status).toBe('idle');
    });

    it('should clear previous slots on reinit', () => {
      const comparison = useComparisonStore();
      const roles1 = [
        { id: 'r1', name: 'A', prompt: 'a', color: '#fff', providerId: 'openai' },
      ];
      comparison.initRoundtable(roles1);
      expect(comparison.slots.length).toBe(1);

      const roles2 = [
        { id: 'r1', name: 'A', prompt: 'a', color: '#fff', providerId: 'openai' },
        { id: 'r2', name: 'B', prompt: 'b', color: '#000', providerId: 'anthropic' },
        { id: 'r3', name: 'C', prompt: 'c', color: '#ccc', providerId: 'gemini' },
      ];
      comparison.initRoundtable(roles2);
      expect(comparison.slots.length).toBe(3);
    });
  });

  describe('chain mode', () => {
    it('should init chain slots with step metadata', () => {
      const comparison = useComparisonStore();
      const steps = [
        { id: 's1', providerId: 'openai', modelId: 'gpt-4o', prompt: 'Step 1' },
        { id: 's2', providerId: 'anthropic', modelId: 'claude-3-5-sonnet', prompt: 'Step 2' },
      ];
      comparison.initChain(steps);

      expect(comparison.slots.length).toBe(2);
      expect(comparison.slots[0].chainStepId).toBe('s1');
      expect(comparison.slots[0].chainStepIndex).toBe(0);
      expect(comparison.slots[1].chainStepId).toBe('s2');
      expect(comparison.slots[1].chainStepIndex).toBe(1);
      expect(comparison.slots[0].status).toBe('idle');
    });

    it('should have all slots idle after init', () => {
      const comparison = useComparisonStore();
      const steps = [
        { id: 's1', providerId: 'openai', modelId: 'gpt-4o', prompt: 'Step 1' },
        { id: 's2', providerId: 'anthropic', modelId: 'claude-3-5-sonnet', prompt: 'Step 2' },
      ];
      comparison.initChain(steps);

      for (const slot of comparison.slots) {
        expect(slot.status).toBe('idle');
        expect(slot.text).toBe('');
      }
      expect(comparison.isRunning).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should clear all slots', () => {
      const comparison = useComparisonStore();
      comparison.initSlots(['openai', 'anthropic']);
      expect(comparison.slots.length).toBe(2);
      comparison.clearAll();
      expect(comparison.slots.length).toBe(0);
    });
  });

  describe('abortAll', () => {
    it('should set isRunning to false', () => {
      const comparison = useComparisonStore();
      comparison.initSlots(['openai']);
      comparison.abortAll();
      expect(comparison.isRunning).toBe(false);
    });
  });
});
