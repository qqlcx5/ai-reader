// ============================================================
// Tests: Shadow DOM Flattener
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { flattenShadowDom } from './shadow-dom';

describe('flattenShadowDom', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  it('should be a no-op when no shadow DOM is present', () => {
    container.innerHTML = '<p>Hello</p><span>World</span>';
    flattenShadowDom(container);
    expect(container.querySelectorAll('p').length).toBe(1);
    expect(container.querySelectorAll('span').length).toBe(1);
  });

  it('should flatten an open shadow root', () => {
    const host = document.createElement('div');
    host.id = 'shadow-host';
    container.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const innerP = document.createElement('p');
    innerP.textContent = 'Inside shadow';
    shadow.appendChild(innerP);

    flattenShadowDom(container);

    // Content should now be in light DOM
    const paragraphs = host.querySelectorAll('p');
    expect(paragraphs.length).toBe(1);
    expect(paragraphs[0].textContent).toBe('Inside shadow');
  });

  it('should handle nested shadow roots', () => {
    const outer = document.createElement('div');
    outer.id = 'outer-host';
    container.appendChild(outer);

    const outerShadow = outer.attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    inner.id = 'inner-host';
    outerShadow.appendChild(inner);

    const innerShadow = inner.attachShadow({ mode: 'open' });
    const p = document.createElement('p');
    p.textContent = 'Deep nested';
    innerShadow.appendChild(p);

    flattenShadowDom(container);

    // All content should be accessible via light DOM queries
    expect(outer.querySelectorAll('p').length).toBe(1);
    expect(outer.textContent).toContain('Deep nested');
  });

  it('should handle multiple shadow hosts', () => {
    const host1 = document.createElement('div');
    const host2 = document.createElement('div');
    container.appendChild(host1);
    container.appendChild(host2);

    const s1 = host1.attachShadow({ mode: 'open' });
    const s2 = host2.attachShadow({ mode: 'open' });

    const p1 = document.createElement('p');
    p1.textContent = 'First';
    s1.appendChild(p1);

    const p2 = document.createElement('p');
    p2.textContent = 'Second';
    s2.appendChild(p2);

    flattenShadowDom(container);

    expect(container.textContent).toContain('First');
    expect(container.textContent).toContain('Second');
  });

  it('should flatten shadow DOM in the full document', () => {
    // Test flattenShadowDom on the document itself
    const host = document.createElement('div');
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    const span = document.createElement('span');
    span.textContent = 'Document-level shadow';
    shadow.appendChild(span);

    flattenShadowDom(document);

    expect(host.textContent).toContain('Document-level shadow');
    document.body.removeChild(host);
  });

  it('should handle shadow hosts with existing light DOM children', () => {
    const host = document.createElement('div');
    container.appendChild(host);

    const lightChild = document.createElement('span');
    lightChild.textContent = 'Light DOM';
    host.appendChild(lightChild);

    const shadow = host.attachShadow({ mode: 'open' });
    const shadowChild = document.createElement('p');
    shadowChild.textContent = 'Shadow DOM';
    shadow.appendChild(shadowChild);

    flattenShadowDom(container);

    expect(host.textContent).toContain('Light DOM');
    expect(host.textContent).toContain('Shadow DOM');
  });
});
