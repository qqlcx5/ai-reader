/**
 * M2 — Context Extraction module entry
 * Exports types, extractors, and transfer utilities.
 */
export * from './types';
export { extractPage, isDomReady, waitForDomReady } from './extractPage';
export {
  splitIntoChunks,
  createChunkedTransfers,
  assembleChunks,
  createTransferMeta,
  createChunkRequest,
  createChunkResponse,
  generateTransferId,
} from './transfer';
export { extractWithReadability } from './extractors/readability';
export { extractWithDefuddle } from './extractors/defuddle';
export { extractWithInnerText } from './extractors/innerText';
export * from './background-integration';
