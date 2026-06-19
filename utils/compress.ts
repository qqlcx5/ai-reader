import LZString from 'lz-string';

/**
 * Compress a UTF-8 string into base64 (safe for chrome.storage values).
 * Uses lz-string's `compressToBase64` for a ~3-5x reduction on typical
 * markdown / JSON payloads.
 */
export function compress(input: string): string {
  return LZString.compressToBase64(input);
}

/**
 * Decompress base64 back to the original UTF-8 string. Returns '' on
 * invalid input rather than throwing, so corrupted history doesn't
 * crash the extension.
 */
export function decompress(input: string): string {
  if (!input) return '';
  try {
    return LZString.decompressFromBase64(input) ?? '';
  } catch {
    return '';
  }
}

/**
 * Returns an estimated byte size for a string, useful for budget checks
 * (chrome.storage.local has a 10MB total budget per extension).
 */
export function approxByteSize(input: string): number {
  return new Blob([input]).size;
}
