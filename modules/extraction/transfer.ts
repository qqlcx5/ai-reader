/**
 * M2 — Chunked transfer protocol for large text
 * 1MB per chunk, supports resume via chunkIndex.
 */
import type { ChunkedTransfer, ChunkRequest, ChunkResponse, TransferMetaMessage } from './types';
import { CHUNK_SIZE } from './types';

export function splitIntoChunks(content: string): string[] {
  const chunks: string[] = [];
  let offset = 0;
  while (offset < content.length) {
    chunks.push(content.slice(offset, offset + CHUNK_SIZE));
    offset += CHUNK_SIZE;
  }
  return chunks;
}

export function createChunkedTransfers(transferId: string, chunks: string[]): ChunkedTransfer[] {
  return chunks.map((chunkData, index) => ({
    transferId,
    totalChunks: chunks.length,
    chunkIndex: index,
    chunkData,
    isLast: index === chunks.length - 1,
  }));
}

export function assembleChunks(chunks: ChunkedTransfer[]): string {
  // Sort by chunkIndex to ensure correct order
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  return sorted.map((c) => c.chunkData).join('');
}

export function createTransferMeta(
  transferId: string,
  totalChunks: number,
  totalSize: number
): TransferMetaMessage {
  return {
    type: 'TRANSFER_META',
    transferId,
    totalChunks,
    totalSize,
  };
}

export function createChunkRequest(transferId: string, chunkIndex: number): ChunkRequest {
  return {
    type: 'REQUEST_CHUNK',
    transferId,
    chunkIndex,
  };
}

export function createChunkResponse(
  transferId: string,
  chunkIndex: number,
  chunkData: string,
  totalChunks: number
): ChunkResponse {
  return {
    type: 'CHUNK_DATA',
    transferId,
    chunkIndex,
    chunkData,
    isLast: chunkIndex === totalChunks - 1,
  };
}

/**
 * Generate a unique transfer ID based on URL + timestamp.
 */
export function generateTransferId(url: string): string {
  const hash = url.split('').reduce((acc, c) => {
    acc = ((acc << 5) - acc) + c.charCodeAt(0);
    return acc & acc;
  }, 0);
  return `${Date.now()}-${Math.abs(hash)}`;
}
