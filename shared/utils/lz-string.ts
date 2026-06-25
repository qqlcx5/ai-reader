/**
 * LZ-string 压缩/解压工具
 * 参考 doc/tasks/persistence.md 章节 2
 * 用于大字段（如 rawHtml）压缩存储
 */
import lz from 'lz-string';

export const LZString = {
  compressToUTF16: (input: string): string => lz.compressToUTF16(input),
  decompressFromUTF16: (input: string): string | null => lz.decompressFromUTF16(input) ?? null,
  compress: (input: string): string => lz.compress(input),
  decompress: (input: string): string | null => lz.decompress(input) ?? null,
};
