// ============================================================
// Shadow DOM Flattener for SuperBrain Content Extraction
// ============================================================

/**
 * Recursively flattens all Shadow DOM trees within a document or element.
 * Moves shadow root children into the host element's light DOM,
 * enabling content extractors (defuddle, Readability) to see
 * content rendered inside Web Components.
 *
 * @param root - Document or Element to recursively flatten
 */
export function flattenShadowDom(root: Document | Element): void {
  const allElements = root.querySelectorAll('*');

  allElements.forEach((el) => {
    // Extensions don't get direct shadowRoot access via .shadowRoot.
    // We use the non-standard yet widely available openOrClosedShadowRoot
    // for closed shadow roots, or .shadowRoot for open ones.
    const shadow = getShadowRoot(el);
    if (!shadow) return;

    // Move all shadow children into the host's light DOM
    while (shadow.firstChild) {
      el.appendChild(shadow.firstChild);
    }

    // Recursively flatten any nested shadow roots inside the moved content
    flattenShadowDom(el);
  });
}

/**
 * Gets the shadow root of an element, including closed shadow roots
 * when the browser exposes them to extensions.
 */
function getShadowRoot(el: Element): ShadowRoot | null {
  // Standard: open shadow roots
  if (el.shadowRoot) return el.shadowRoot;

  // Chrome-specific: extensions with sufficient permissions can access
  // closed shadow roots via this internal API.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const htmlEl = el as any;
  if (typeof htmlEl.openOrClosedShadowRoot !== 'undefined') {
    return htmlEl.openOrClosedShadowRoot as ShadowRoot | null;
  }

  return null;
}
