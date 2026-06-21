/**
 * M5 Workflows — Template Store
 *
 * In-memory template registry with localStorage persistence.
 * Provides CRUD operations for workflow templates.
 *
 * Based on design-05-workflows.md §3.3.
 */

import type { WorkflowTemplate, WorkflowType } from './types';
import { DEFAULT_ROUNDTABLE_TEMPLATE, DEFAULT_RELAY_TEMPLATE } from './types';

// ─── State ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'workflow-templates-store';

let templates: WorkflowTemplate[] = [];

// ─── Init ────────────────────────────────────────────────────────────

export async function loadTemplates(): Promise<WorkflowTemplate[]> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      if (stored[STORAGE_KEY]) {
        templates = stored[STORAGE_KEY] as WorkflowTemplate[];
      }
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) templates = JSON.parse(raw);
    }
  } catch {
    // Ignore
  }

  // Seed defaults if empty
  if (templates.length === 0) {
    templates = await seedDefaultTemplates();
  }

  return templates;
}

// ─── CRUD ────────────────────────────────────────────────────────────

export function getAllTemplates(): Readonly<WorkflowTemplate>[] {
  return templates;
}

export function getTemplatesByType(type: WorkflowType): Readonly<WorkflowTemplate>[] {
  return templates.filter((t) => t.type === type);
}

export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return templates.find((t) => t.id === id);
}

export function addTemplate(template: WorkflowTemplate): void {
  templates.push(template);
  persistTemplates();
}

export function updateTemplate(id: string, patch: Partial<WorkflowTemplate>): void {
  const idx = templates.findIndex((t) => t.id === id);
  if (idx !== -1) {
    templates[idx] = { ...templates[idx], ...patch, updatedAt: Date.now() };
    persistTemplates();
  }
}

export function removeTemplate(id: string): void {
  templates = templates.filter((t) => t.id !== id);
  persistTemplates();
}

export function generateTemplateId(): string {
  return `tmpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Persistence ─────────────────────────────────────────────────────

async function persistTemplates(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [STORAGE_KEY]: templates });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    }
  } catch {
    // Ignore persistence error
  }
}

async function seedDefaultTemplates(): Promise<WorkflowTemplate[]> {
  const now = Date.now();

  const defaults: WorkflowTemplate[] = [
    {
      ...DEFAULT_ROUNDTABLE_TEMPLATE,
      id: 'tmpl-default-roundtable',
      createdAt: now,
      updatedAt: now,
    },
    {
      ...DEFAULT_RELAY_TEMPLATE,
      id: 'tmpl-default-relay',
      createdAt: now,
      updatedAt: now,
    },
  ];

  await persistTemplates();
  return defaults;
}
