import { describe, it, expect } from 'vitest';
import { BUILTIN_TEMPLATE_DEFS, validateTemplate, assertValidForRun } from '../templates';

describe('BUILTIN_TEMPLATE_DEFS', () => {
  it('exposes exactly 2 built-in templates', () => {
    expect(BUILTIN_TEMPLATE_DEFS).toHaveLength(2);
  });

  it('roundtable template has 3 nodes with distinct ids', () => {
    const rt = BUILTIN_TEMPLATE_DEFS.find((t) => t.type === 'roundtable')!;
    expect(rt.nodes).toHaveLength(3);
    const ids = new Set(rt.nodes.map((n) => n.id));
    expect(ids.size).toBe(3);
    expect(rt.nodes.every((n) => n.systemPrompt.length > 0)).toBe(true);
  });

  it('relay template has a linear chain', () => {
    const relay = BUILTIN_TEMPLATE_DEFS.find((t) => t.type === 'relay')!;
    expect(relay.nodes).toHaveLength(3);
    const sorted = [...relay.nodes].sort((a, b) => a.order - b.order);
    expect(sorted[1].upstreamNodeIds).toEqual([sorted[0].id]);
    expect(sorted[2].upstreamNodeIds).toEqual([sorted[1].id]);
  });
});

describe('validateTemplate', () => {
  const goodNode = (id: string, prompt = 'p', upstream: string[] = []) => ({
    id,
    order: 0,
    name: id,
    providerId: 'p',
    systemPrompt: prompt,
    upstreamNodeIds: upstream,
  });

  it('passes on a minimal valid template', () => {
    const r = validateTemplate('t', 'roundtable', [goodNode('a')]);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('rejects empty name', () => {
    const r = validateTemplate('', 'roundtable', [goodNode('a')]);
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/name/);
  });

  it('rejects empty node list', () => {
    const r = validateTemplate('t', 'roundtable', []);
    expect(r.valid).toBe(false);
  });

  it('rejects duplicate node ids', () => {
    const r = validateTemplate('t', 'roundtable', [goodNode('a'), goodNode('a')]);
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toMatch(/Duplicate/);
  });

  it('rejects empty system prompt', () => {
    const r = validateTemplate('t', 'roundtable', [goodNode('a', '')]);
    expect(r.valid).toBe(false);
  });

  it('rejects cycles in relay chain', () => {
    const r = validateTemplate('t', 'relay', [goodNode('a', 'p', ['b']), goodNode('b', 'p', ['a'])]);
    expect(r.valid).toBe(false);
    expect(r.errors.join('\n')).toMatch(/cycle/i);
  });

  it('enforces max node count per type', () => {
    const tooMany = Array.from({ length: 10 }, (_, i) => goodNode(String(i)));
    expect(validateTemplate('t', 'roundtable', tooMany).valid).toBe(false);
    expect(validateTemplate('t', 'relay', tooMany).valid).toBe(false);
  });
});

describe('assertValidForRun', () => {
  it('throws on invalid template', () => {
    expect(() => assertValidForRun('roundtable', [])).toThrow();
  });
});
