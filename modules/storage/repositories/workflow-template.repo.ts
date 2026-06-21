import { getDb } from '../db';
import type { WorkflowTemplateRecord } from '../types';

/**
 * M5 — Workflow template repository.
 *
 * Templates are reusable Roundtable / Relay Chain configurations.
 * Built-in templates (Roundtable debate, Relay Chain review) live here
 * alongside user templates; the `builtIn` flag prevents accidental
 * deletion through the normal delete path.
 */
export class WorkflowTemplateRepository {
  private get table() {
    return getDb().workflowTemplates;
  }

  async create(
    record: Omit<WorkflowTemplateRecord, 'id' | 'createdAt' | 'updatedAt' | 'builtIn'>,
  ): Promise<WorkflowTemplateRecord> {
    const now = Date.now();
    const item: WorkflowTemplateRecord = {
      ...record,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      builtIn: false,
    };
    await this.table.add(item);
    return item;
  }

  async upsert(record: WorkflowTemplateRecord): Promise<void> {
    const next: WorkflowTemplateRecord = { ...record, updatedAt: Date.now() };
    await this.table.put(next);
  }

  async list(): Promise<WorkflowTemplateRecord[]> {
    return this.table.orderBy('updatedAt').reverse().toArray();
  }

  async listByType(type: 'roundtable' | 'relay'): Promise<WorkflowTemplateRecord[]> {
    return this.table.where('type').equals(type).toArray();
  }

  async getById(id: string): Promise<WorkflowTemplateRecord | undefined> {
    return this.table.get(id);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.table.get(id);
    if (!existing) return;
    if (existing.builtIn) {
      throw new Error('Built-in templates cannot be deleted');
    }
    await this.table.delete(id);
  }

  /**
   * Seed built-in templates on first run. No-op if they already exist
   * (matched by the stable `name` field).
   */
  async seedBuiltIn(builtins: Array<Omit<WorkflowTemplateRecord, 'id' | 'createdAt' | 'updatedAt' | 'builtIn'>>): Promise<void> {
    for (const tpl of builtins) {
      const existing = await this.table.where('name').equals(tpl.name).first();
      if (existing) continue;
      const now = Date.now();
      await this.table.add({
        ...tpl,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        builtIn: true,
      });
    }
  }
}

export const workflowTemplateRepo = new WorkflowTemplateRepository();
