// ============================================================
// PageMind — Shadow DOM Flattening Utility
// ============================================================
// Recursively flattens Shadow DOM trees into the light DOM so
// defuddle (which only sees the light DOM) can extract content
// from Web Components (Shoelace, Lit, etc.).

type Flattenable = Document | Element | ShadowRoot

/**
 * Recursively flatten all Shadow Roots in the given root into light DOM.
 *
 * For every element that has an open shadowRoot, its child nodes are
 * moved into the host element itself. Nested shadow trees are
 * processed first (depth-first) so inner components are flattened before
 * their ancestors.
 *
 * A 3-second timeout guard prevents the operation from blocking the
 * content script on extremely complex pages.
 */
export async function flattenShadowDom(root: Document | Element): Promise<void> {
  const TIMEOUT_MS = 3_000

  return Promise.race([
    Promise.resolve(doFlatten(root)),
    new Promise<void>((resolve) => setTimeout(resolve, TIMEOUT_MS)),
  ])
}

function doFlatten(root: Flattenable): void {
  const allElements = (root as ParentNode).querySelectorAll('*')
  if (!allElements) return

  for (const el of allElements) {
    const shadowRoot = (el as HTMLElement).shadowRoot
    if (!shadowRoot) continue

    // Depth-first: flatten nested shadow trees first
    doFlatten(shadowRoot)

    // Move shadow root children into the host element's light DOM.
    // appendChild removes a node from its current parent (the shadow root)
    // and re-attaches it here, so no cloning is needed.
    while (shadowRoot.firstChild) {
      el.appendChild(shadowRoot.firstChild)
    }
  }
}
