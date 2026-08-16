/**
 * Ambient declarations for WXT macros and CSS side-effect imports.
 * These are normally provided by .wxt/types/ but may not be picked up
 * by the IDE language server.
 */

// WXT entrypoint macros
declare function defineBackground(
  fn: () => void | Promise<void>,
): void

declare function defineContentScript(
  options: {
    matches?: string[]
    excludeMatches?: string[]
    includeGlobs?: string[]
    excludeGlobs?: string[]
    runAt?: 'document_start' | 'document_end' | 'document_idle'
    main: () => void | Promise<void>
  },
): void

// WXT-injected global: `browser` (WebExtension API)
declare const browser: typeof import('wxt/browser')['browser']

// vue-sonner CSS side-effect import
declare module 'vue-sonner/style.css'

// Vite asset URL import for the pdf.js worker
declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const workerUrl: string
  export default workerUrl
}
