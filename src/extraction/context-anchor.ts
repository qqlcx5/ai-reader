/**
 * Context Anchoring
 *
 * Manages the relationship between a browser Tab and its extracted content.
 * Ensures that when the user switches tabs, the workspace shows the correct
 * article without automatically refreshing from the new tab's URL.
 *
 * Key invariant: Tab switch ≠ auto-refresh. The user must explicitly
 * request extraction for a new tab.
 *
 * Based on design-02-extraction.md §6.
 */

import type { ContextAnchor } from './types';
import type { ExtractedContext } from './types';

// ─── In-Memory Store ─────────────────────────────────────────────────

const anchors = new Map<string, ContextAnchor>();
const contextCache = new Map<string, ExtractedContext>();

/** Default TTL: 30 minutes */
const ANCHOR_TTL_MS = 30 * 60 * 1000;

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Create or update a context anchor for a tab.
 */
export function setAnchor(
  anchorId: string,
  tabId: number,
  url: string,
): ContextAnchor {
  const now = Date.now();
  const anchor: ContextAnchor = {
    anchorId,
    tabId,
    url,
    createdAt: anchors.get(anchorId)?.createdAt ?? now,
    lastAccessedAt: now,
  };
  anchors.set(anchorId, anchor);
  return anchor;
}

/**
 * Get the anchor for a given ID.
 * Updates lastAccessedAt on access.
 */
export function getAnchor(anchorId: string): ContextAnchor | undefined {
  const anchor = anchors.get(anchorId);
  if (anchor) {
    anchor.lastAccessedAt = Date.now();
  }
  return anchor;
}

/**
 * Check if this anchor is still valid for the given tabId.
 * Returns true if the anchor's tab matches the current tab.
 */
export function isAnchorValid(anchorId: string, tabId: number): boolean {
  const anchor = anchors.get(anchorId);
  if (!anchor) return false;
  return anchor.tabId === tabId;
}

/**
 * Cache extracted context associated with an anchor.
 */
export function cacheContext(anchorId: string, context: ExtractedContext): void {
  contextCache.set(anchorId, context);
  const anchor = anchors.get(anchorId);
  if (anchor) {
    anchor.contextHash = simpleHash(JSON.stringify(context));
  }
}

/**
 * Get cached context for an anchor.
 */
export function getCachedContext(anchorId: string): ExtractedContext | undefined {
  return contextCache.get(anchorId);
}

/**
 * Check if the cached context is still valid (matching anchor and URL).
 */
export function isCacheValid(anchorId: string, tabId: number, url: string): boolean {
  const anchor = anchors.get(anchorId);
  if (!anchor) return false;
  if (anchor.tabId !== tabId) return false;
  if (anchor.url !== url) return false;
  return contextCache.has(anchorId);
}

/**
 * Remove an anchor and its cached context.
 */
export function removeAnchor(anchorId: string): void {
  anchors.delete(anchorId);
  contextCache.delete(anchorId);
}

/**
 * Clean up stale anchors older than TTL.
 */
export function cleanupStaleAnchors(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, anchor] of anchors) {
    if (now - anchor.lastAccessedAt > ANCHOR_TTL_MS) {
      anchors.delete(id);
      contextCache.delete(id);
      cleaned++;
    }
  }
  return cleaned;
}

// ─── Helper ─────────────────────────────────────────────────────────

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit int
  }
  return hash.toString(36);
}
