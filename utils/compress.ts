/**
 * Compression utilities using lz-string.
 */

import LZString from 'lz-string'

export function compressText(text: string): string {
  return LZString.compressToUTF16(text)
}

export function decompressText(compressed: string): string {
  return LZString.decompressFromUTF16(compressed) || ''
}
