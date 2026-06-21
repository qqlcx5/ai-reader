/**
 * Obsidian URI Builder & Note Creator
 *
 * Generates `obsidian://new` and `obsidian://daily` URIs per the
 * Obsidian URI scheme specification.  Supports:
 *  - vault selection
 *  - folder path targeting
 *  - append / prepend / overwrite behaviors
 *  - daily note mode
 *  - clipboard mode (privacy-preserving) with URI content fallback
 *  - silent open
 *
 * Based on obsidian-clipper's obsidian-note-creator.ts.
 */

import type { ObsidianConfig, ExportResult, ExportTask, Property } from './types';

// ─── URI Construction ────────────────────────────────────────────────

/**
 * Build an Obsidian URI for creating a new note.
 *
 * @param title - Note title (derived from article title)
 * @param content - Full Markdown content
 * @param vault - Obsidian vault name
 * @param folder - Optional folder path within vault
 * @param behavior - append / prepend / overwrite / append-daily / prepend-daily
 */
export function buildObsidianUri(
  title: string,
  content: string,
  vault: string,
  folder: string = '',
  behavior: 'overwrite' | 'append' | 'prepend' | 'append-daily' | 'prepend-daily' = 'overwrite',
): string {
  const isDailyNote = behavior === 'append-daily' || behavior === 'prepend-daily';

  let uri: string;

  if (isDailyNote) {
    uri = 'obsidian://daily?';
  } else {
    const cleanPath = folder ? `${folder.replace(/\/$/, '')}/` : '';
    const safeName = sanitizeFileName(title);
    uri = `obsidian://new?file=${encodeURIComponent(cleanPath + safeName)}`;
  }

  // Behavior
  if (behavior.startsWith('append')) {
    uri += '&append=true';
  } else if (behavior.startsWith('prepend')) {
    uri += '&prepend=true';
  } else {
    uri += '&overwrite=true';
  }

  // Vault
  if (vault) {
    uri += `&vault=${encodeURIComponent(vault)}`;
  }

  // Content is added by the caller (via clipboard or direct)
  return uri;
}

// ─── Clipboard + URI Dual-Channel ────────────────────────────────────

/**
 * Write content to clipboard first, then open Obsidian with &clipboard.
 * This avoids the URI length limit (browsers typically cap at ~2MB).
 * Falls back to direct URI content embedding if clipboard fails.
 */
export async function openInObsidianViaClipboard(
  uri: string,
  content: string,
): Promise<ExportResult> {
  const taskId = generateTaskId('obsidian');

  try {
    const success = await writeClipboard(content);

    if (success) {
      // &clipboard tells Obsidian to read content from the clipboard
      // &content provides a fallback message shown if clipboard access fails
      const fallbackMsg = 'Clipboard access denied. Please paste the content manually or check browser permissions.';
      const fullUri = `${uri}&clipboard&content=${encodeURIComponent(fallbackMsg)}`;
      openObsidianUrl(fullUri);

      return {
        success: true,
        taskId,
        obsidianUri: fullUri,
      };
    } else {
      // Clipboard failed — embed content directly (subject to URI length limit)
      return openInObsidianDirect(uri, content, taskId);
    }
  } catch (err) {
    return {
      success: false,
      taskId,
      error: {
        code: 'CLIPBOARD_FAILED',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Open Obsidian with content embedded directly in the URI.
 * This may fail for large articles due to URI length limits.
 */
export function openInObsidianDirect(
  uri: string,
  content: string,
  taskId?: string,
): ExportResult {
  const id = taskId || generateTaskId('obsidian');

  // Check URI length — browsers have varying limits but
  // Chrome is typically ~2MB. Obsidian itself may have lower limits.
  const fullUri = `${uri}&content=${encodeURIComponent(content)}`;

  if (fullUri.length > 2_000_000) {
    return {
      success: false,
      taskId: id,
      error: {
        code: 'URI_TOO_LONG',
        message: `Content length (${fullUri.length} chars) exceeds 2MB URI limit. Try clipboard mode or reduce content size.`,
      },
    };
  }

  openObsidianUrl(fullUri);

  return {
    success: true,
    taskId: id,
    obsidianUri: fullUri,
  };
}

// ─── Convenience ─────────────────────────────────────────────────────

/**
 * Export a note to Obsidian, automatically choosing clipboard or direct mode.
 */
export async function exportToObsidian(
  title: string,
  content: string,
  config: ObsidianConfig,
): Promise<ExportResult> {
  const uri = buildObsidianUri(
    title,
    content,
    config.vaultName,
    config.defaultFolder,
    config.behavior,
  );

  let uriWithOptions = uri;

  // Silent open
  if (config.silentOpen) {
    uriWithOptions += '&silent=true';
  }

  if (config.useClipboard && !config.legacyMode) {
    return openInObsidianViaClipboard(uriWithOptions, content);
  } else {
    return openInObsidianDirect(uriWithOptions, content);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

let taskCounter = 0;

function generateTaskId(prefix: string): string {
  taskCounter = (taskCounter + 1) % 100000;
  return `${prefix}_${Date.now()}_${taskCounter}`;
}

function sanitizeFileName(fileName: string): string {
  let sanitized = fileName
    .replace(/[#|^\[\]]/g, '')     // Obsidian-specific characters
    .replace(/[<>:"/\\?*]/g, '')   // Windows forbidden
    .replace(/[:\/]/g, '')         // macOS forbidden
    .replace(/[\x00-\x1F]/g, '')   // Control characters
    .replace(/^\.+/, '')           // Leading dots
    .replace(/[\s.]+$/, '')        // Trailing spaces/dots
    .trim();

  // Ensure non-empty
  if (!sanitized) sanitized = 'Untitled';

  // Truncate to 200 chars
  return sanitized.slice(0, 200);
}

function openObsidianUrl(url: string): void {
  try {
    // Background script can handle the navigation
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'openObsidianUrl', url }).catch(() => {
        window.open(url, '_blank');
      });
    } else {
      window.open(url, '_blank');
    }
  } catch {
    window.open(url, '_blank');
  }
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: use a textarea
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}
